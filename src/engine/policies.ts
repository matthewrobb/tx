// src/engine/policies.ts — Expression-based policy engine (S-017)
//
// Policies are named, expression-based rules that gate operations. Each policy
// hook maps to an expression string from config. The expression evaluates to
// one of three outcomes:
//
//   allow             — operation proceeds normally
//   require_approval  — operation paused; user must confirm via interactive expr
//   block             — operation cannot proceed; error returned
//
// When no policy is configured for a hook, the operation is allowed by default.
// Expression errors block by default — this is the safer choice vs. silently
// allowing an operation whose guard failed to evaluate.

import type { ExpressionContext } from '../types/expressions.js';
import type { AgentAction } from '../types/protocol.js';
import type { PolicyHook, PolicyConfig } from '../types/config.js';
import type { ExprFn } from './expressions/functions.js';
import { ExpressionEvaluator } from './expressions/evaluator.js';
import { createInteractiveFunctions } from './expressions/interactive.js';

// ---------------------------------------------------------------------------
// Policy result types
// ---------------------------------------------------------------------------

export type PolicyOutcome = 'allow' | 'require_approval' | 'block';

export interface PolicyResult {
  outcome: PolicyOutcome;
  policy_name: string;
  /** Only present when outcome === 'require_approval'. */
  action?: AgentAction;
  /** Only present when outcome === 'block'. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Built-in "allow" function — always returns true
// ---------------------------------------------------------------------------

/**
 * allow() — built-in function that explicitly allows an operation.
 *
 * Registered as a named function so "allow" in a policy expression resolves
 * to a function call rather than an unknown identifier (which would be null
 * and therefore block). Usage: `"allow"` as a bare identifier is parsed as
 * an identifier node, but we also register it as a zero-arg function so
 * `"allow()"` works too. The bare identifier case is handled separately by
 * checking the string literal before evaluation.
 */
function allowFn(..._args: Parameters<ExprFn>): ReturnType<ExprFn> {
  return { ok: true, value: true };
}

// ---------------------------------------------------------------------------
// PolicyEngine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private readonly evaluator: ExpressionEvaluator;

  constructor(private readonly policies: PolicyConfig) {
    // Combine interactive functions (confirm, prompt, choose) with allow()
    const fns = createInteractiveFunctions();
    fns.set('allow', allowFn);
    this.evaluator = new ExpressionEvaluator(fns);
  }

  /**
   * Evaluate a policy hook against a context.
   *
   * Returns 'allow' if no policy is configured for the hook.
   */
  evaluate(hook: PolicyHook, context: ExpressionContext): PolicyResult {
    const expression = this.policies[hook];

    // No policy configured — default to allow
    if (expression === undefined) {
      return { outcome: 'allow', policy_name: hook };
    }

    // Special-case: bare "allow" string — recognized before evaluation so we
    // don't need the expression parser to handle it as a function call vs.
    // identifier ambiguity. This is a UX convenience.
    if (expression === 'allow') {
      return { outcome: 'allow', policy_name: hook };
    }

    const result = this.evaluator.evaluate(expression, context);

    if (result.ok === true) {
      // String literal outcomes — explicit "allow" or "block" strings returned
      // from expression evaluation (distinct from the bare "allow" shorthand above,
      // this handles expressions that compute a string result)
      if (result.value === 'allow') {
        return { outcome: 'allow', policy_name: hook };
      }
      if (result.value === 'block') {
        return { outcome: 'block', policy_name: hook, reason: 'Policy returned "block"' };
      }

      // Boolean-like truthiness
      if (result.value === true || (result.value !== false && result.value !== null && result.value !== 0 && result.value !== '')) {
        return { outcome: 'allow', policy_name: hook };
      }

      // Falsy → block
      return {
        outcome: 'block',
        policy_name: hook,
        reason: 'Policy expression evaluated to false',
      };
    }

    if (result.ok === 'paused') {
      return {
        outcome: 'require_approval',
        policy_name: hook,
        action: result.action,
      };
    }

    // result.ok === false — expression error → block (safer than allowing)
    return {
      outcome: 'block',
      policy_name: hook,
      reason: result.error,
    };
  }
}
