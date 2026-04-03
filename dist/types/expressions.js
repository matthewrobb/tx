// src/types/expressions.ts — Expression AST and evaluation types for v4.
//
// The expression system evaluates condition strings like:
//   done_when: "artifacts.all_present"
//   skip_when: "issue.type == 'chore'"
//   block_when: "not tasks.all_done and issue.status == 'blocked'"
//
// Expressions are parsed into an AST (ExpressionNode) and evaluated against
// an ExpressionContext that provides runtime data about the issue, artifacts,
// tasks, and cycle.
export {};
//# sourceMappingURL=expressions.js.map