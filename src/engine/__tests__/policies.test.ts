import { describe, test, expect } from 'vitest';
import { PolicyEngine } from '../policies.js';
import type { PolicyResult } from '../policies.js';
import type { ExpressionContext } from '../../types/expressions.js';
import type { PolicyConfig } from '../../types/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ExpressionContext for policy evaluation tests. */
function makeContext(overrides: Partial<ExpressionContext> = {}): ExpressionContext {
  return {
    vars: {},
    issue: {
      issue: 'test',
      type: 'feature',
      workflow_id: 'default',
      step: 'build',
      status: 'open',
      tasks_done: 0,
      tasks_total: null,
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    },
    artifacts: {
      all_present: false,
      exists: () => false,
    },
    tasks: {
      all_done: false,
      done_count: 0,
      total_count: 0,
    },
    cycle: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PolicyEngine', () => {
  test('no policy configured → always returns allow', () => {
    const engine = new PolicyEngine({});
    const result = engine.evaluate('deferral', makeContext());

    expect(result.outcome).toBe('allow');
    expect(result.policy_name).toBe('deferral');
    expect(result.action).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  test('expression "true" → allow', () => {
    const policies: PolicyConfig = { deferral: 'true' };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('deferral', makeContext());

    expect(result.outcome).toBe('allow');
    expect(result.policy_name).toBe('deferral');
  });

  test('expression "false" → block', () => {
    const policies: PolicyConfig = { decision: 'false' };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('decision', makeContext());

    expect(result.outcome).toBe('block');
    expect(result.policy_name).toBe('decision');
    expect(result.reason).toBe('Policy expression evaluated to false');
  });

  test('expression with confirm() → require_approval with confirm action', () => {
    const policies: PolicyConfig = { deferral: "confirm('proceed?')" };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('deferral', makeContext());

    expect(result.outcome).toBe('require_approval');
    expect(result.policy_name).toBe('deferral');
    expect(result.action).toEqual({
      type: 'confirm',
      message: 'proceed?',
      next_command: 'resume',
    });
  });

  test('expression error → block with error as reason', () => {
    // Unknown function call should produce an error result
    const policies: PolicyConfig = { scope_change: "bogus_function()" };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('scope_change', makeContext());

    expect(result.outcome).toBe('block');
    expect(result.policy_name).toBe('scope_change');
    expect(result.reason).toContain('Unknown function');
  });

  test('"allow" literal → allow', () => {
    const policies: PolicyConfig = { issue_create: 'allow' };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('issue_create', makeContext());

    expect(result.outcome).toBe('allow');
    expect(result.policy_name).toBe('issue_create');
  });

  test('complex: issue.type == \'release\' with feature context → block', () => {
    const policies: PolicyConfig = { scope_change: "issue.type == 'release'" };
    const engine = new PolicyEngine(policies);
    const ctx = makeContext({
      issue: {
        issue: 'test',
        type: 'feature',
        workflow_id: 'default',
        step: 'build',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });
    const result = engine.evaluate('scope_change', ctx);

    expect(result.outcome).toBe('block');
    expect(result.reason).toBe('Policy expression evaluated to false');
  });

  test('complex: issue.type == \'release\' with release context → allow', () => {
    const policies: PolicyConfig = { scope_change: "issue.type == 'release'" };
    const engine = new PolicyEngine(policies);
    const ctx = makeContext({
      issue: {
        issue: 'rel-1',
        type: 'release',
        workflow_id: 'default',
        step: 'build',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });
    const result = engine.evaluate('scope_change', ctx);

    expect(result.outcome).toBe('allow');
  });

  test('allow() as function call → allow', () => {
    const policies: PolicyConfig = { deferral: 'allow()' };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('deferral', makeContext());

    expect(result.outcome).toBe('allow');
  });

  test('short-circuit: false and confirm() → block without pausing', () => {
    // The "and" short-circuits: false on the left means confirm() is never reached
    const policies: PolicyConfig = { deferral: "false and confirm('never seen')" };
    const engine = new PolicyEngine(policies);
    const result = engine.evaluate('deferral', makeContext());

    expect(result.outcome).toBe('block');
    expect(result.reason).toBe('Policy expression evaluated to false');
    expect(result.action).toBeUndefined();
  });

  test('unconfigured hooks do not affect configured hooks', () => {
    // Only deferral is configured; other hooks should still default to allow
    const policies: PolicyConfig = { deferral: 'false' };
    const engine = new PolicyEngine(policies);

    const deferralResult = engine.evaluate('deferral', makeContext());
    expect(deferralResult.outcome).toBe('block');

    const decisionResult = engine.evaluate('decision', makeContext());
    expect(decisionResult.outcome).toBe('allow');

    const scopeResult = engine.evaluate('scope_change', makeContext());
    expect(scopeResult.outcome).toBe('allow');

    const createResult = engine.evaluate('issue_create', makeContext());
    expect(createResult.outcome).toBe('allow');
  });
});
