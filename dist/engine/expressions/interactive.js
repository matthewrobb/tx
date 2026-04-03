// src/engine/expressions/interactive.ts — Interactive expression functions
//
// These functions produce PausedResult values that signal the engine to pause
// evaluation, surface a prompt to the user, and resume once a response arrives.
//
// Pause/resume flow:
//   1. Expression evaluation hits confirm(), prompt(), or choose()
//   2. Function returns { ok: 'paused', action: AgentAction }
//   3. Engine (S-011) detects the paused result, persists state to DB
//   4. CLI surfaces the AgentAction to the user
//   5. User responds; daemon stores the response as a var in the DB
//      (issue_slug, step, key=function_name, value=user_response)
//   6. Resumed evaluation finds the var via ExpressionContext.vars,
//      so the expression resolves without pausing again
//
// The interactive functions do NOT store or read vars — that's the engine's
// responsibility (S-011). These functions only produce the pause signal.
import { ExpressionEvaluator } from './evaluator.js';
// ---------------------------------------------------------------------------
// Interactive function implementations
// ---------------------------------------------------------------------------
/**
 * confirm(message) — pause evaluation for a yes/no confirmation.
 *
 * Returns a PausedResult with a 'confirm' action. The CLI presents the
 * message and the user confirms or denies. On resume, the engine stores
 * the boolean response as a var and re-evaluates.
 */
function confirmFn(...args) {
    if (args.length !== 1) {
        return { ok: false, error: `confirm() expects 1 argument, got ${args.length}` };
    }
    const message = args[0];
    if (typeof message !== 'string') {
        return { ok: false, error: 'confirm() argument must be a string' };
    }
    const action = {
        type: 'confirm',
        message,
        next_command: 'resume',
    };
    return { ok: 'paused', action };
}
/**
 * prompt(message) — pause evaluation for free-text user input.
 *
 * Returns a PausedResult with a 'prompt_user' action. The CLI shows the
 * prompt and collects a text response. On resume, the engine stores the
 * text as a var.
 */
function promptFn(...args) {
    if (args.length !== 1) {
        return { ok: false, error: `prompt() expects 1 argument, got ${args.length}` };
    }
    const prompt = args[0];
    if (typeof prompt !== 'string') {
        return { ok: false, error: 'prompt() argument must be a string' };
    }
    const action = {
        type: 'prompt_user',
        prompt,
    };
    return { ok: 'paused', action };
}
/**
 * choose(message, ...choices) — pause evaluation for a multiple-choice selection.
 *
 * Returns a PausedResult with a 'prompt_user' action that includes categories.
 * The CLI presents the choices and the user picks one. On resume, the engine
 * stores the selected value as a var.
 */
function chooseFn(...args) {
    if (args.length < 2) {
        return { ok: false, error: `choose() expects at least 2 arguments (message + choices), got ${args.length}` };
    }
    const message = args[0];
    if (typeof message !== 'string') {
        return { ok: false, error: 'choose() first argument must be a string' };
    }
    const choices = args.slice(1);
    for (let i = 0; i < choices.length; i++) {
        if (typeof choices[i] !== 'string') {
            return { ok: false, error: `choose() choice at index ${i + 1} must be a string` };
        }
    }
    const action = {
        type: 'prompt_user',
        prompt: message,
        categories: choices,
    };
    return { ok: 'paused', action };
}
// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------
/**
 * Create a Map of interactive expression functions.
 *
 * Returns a new Map each time (same pattern as createBuiltinFunctions)
 * so callers can extend without mutation.
 */
export function createInteractiveFunctions() {
    const fns = new Map();
    fns.set('confirm', confirmFn);
    fns.set('prompt', promptFn);
    fns.set('choose', chooseFn);
    return fns;
}
/**
 * Create an ExpressionEvaluator with both built-in and interactive functions.
 *
 * Convenience factory for contexts where interactive expressions are expected
 * (e.g., step condition evaluation in the engine). Non-interactive contexts
 * (e.g., config validation) should use the base ExpressionEvaluator instead.
 */
export function createInteractiveEvaluator() {
    return new ExpressionEvaluator(createInteractiveFunctions());
}
//# sourceMappingURL=interactive.js.map