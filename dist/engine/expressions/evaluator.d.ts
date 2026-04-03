import type { ExpressionContext, EvalResult } from '../../types/expressions.js';
import type { ExpressionEvaluatorPort } from '../../ports/expression.js';
import type { ExprFn } from './functions.js';
export declare class ExpressionEvaluator implements ExpressionEvaluatorPort {
    private readonly functions;
    constructor(extraFunctions?: Map<string, ExprFn>);
    evaluate(expression: string, context: ExpressionContext): EvalResult;
    validate(expression: string): {
        readonly valid: true;
    } | {
        readonly valid: false;
        readonly error: string;
    };
    private evalNode;
    /**
     * Resolve a top-level identifier against the context namespaces.
     *
     * The context has a fixed set of namespaces (vars, issue, artifacts, tasks,
     * cycle). We resolve identifiers in order:
     *   1. Context namespace (issue, artifacts, tasks, cycle, vars)
     *   2. Return null for unknown identifiers (don't error)
     *
     * Returning null for unknowns is intentional — it allows expressions to be
     * written before all context is populated, and the engine can handle nulls
     * in its own logic (e.g., "skip this step if X is null").
     */
    private evalIdentifier;
    /**
     * Evaluate member access: obj.property
     *
     * Null propagation: if the object evaluates to null, return null.
     * This avoids runtime errors when optional context (like cycle) is absent.
     */
    private evalMember;
    /**
     * Evaluate function calls.
     *
     * The callee is resolved by name from the function registry.
     * Member-style calls like `artifacts.exists('foo')` are NOT supported in v1 —
     * we only support top-level function calls. Member access on the callee is
     * handled by the parser as `Call(Member(...), args)` but the evaluator needs
     * a function name string, so we extract it from the AST.
     */
    private evalCall;
    /**
     * Extract a function name from a callee AST node.
     *
     * Supports:
     * - IdentifierNode: `defined(x)` → "defined"
     * - MemberNode: `ns.fn(x)` → "ns.fn" (dot-joined)
     *
     * Returns null for other node kinds (e.g., CallNode — no currying).
     */
    private resolveFunctionName;
    /**
     * Evaluate binary operations with short-circuit semantics for and/or.
     *
     * Comparison uses JSON-level equality (==, !=) and numeric ordering (<, <=, >, >=).
     * Non-numeric operands to ordering comparisons return false rather than erroring,
     * consistent with the "return values, don't throw" philosophy.
     */
    private evalBinary;
    private evalUnary;
    /**
     * Convert a runtime value to Json for the evaluator's return path.
     *
     * ExpressionContext contains typed objects (ArtifactContext, TaskContext, etc.)
     * that have function properties (e.g., `exists()`). We convert these to plain
     * Json objects by extracting only their non-function properties.
     *
     * For the 'exists' function on ArtifactContext: it's callable via the function
     * registry, not via member access. Member access on artifacts returns the
     * plain JSON-serializable properties.
     */
    private toJson;
}
//# sourceMappingURL=evaluator.d.ts.map