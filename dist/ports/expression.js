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
export {};
//# sourceMappingURL=expression.js.map