/**
 * ExpressionEvaluatorPort — evaluate expression strings against a context.
 *
 * The workflow engine uses expressions for step conditions:
 * - `exit_when`: "artifacts.all_present"
 * - `skip_when`: "issue.type == 'bug'"
 * - `block_when`: "!config.validated"
 *
 * The expression system supports context namespaces (artifacts, issue, config,
 * vars, etc.) that resolve lazily against DB queries. The evaluator is a pure
 * function — it does not perform side effects or modify state.
 *
 * Interactive expression functions (confirm, prompt, choose) are handled by
 * S-006 and produce pause/resume semantics — they are NOT part of this port.
 * This port covers synchronous, deterministic evaluation only.
 */
import type { ExpressionContext, EvalResult } from '../types/expressions.js';
export interface ExpressionEvaluatorPort {
    /**
     * Evaluate an expression string against a context.
     *
     * Returns a discriminated result rather than throwing — expression failures
     * are an expected control flow path (e.g., step blocked because a namespace
     * isn't populated yet).
     */
    evaluate(expression: string, context: ExpressionContext): EvalResult;
    /**
     * Validate that an expression is syntactically valid without evaluating it.
     * Used during config validation (S-007) to catch malformed expressions
     * at load time rather than at runtime.
     */
    validate(expression: string): {
        readonly valid: true;
    } | {
        readonly valid: false;
        readonly error: string;
    };
}
//# sourceMappingURL=expression.d.ts.map