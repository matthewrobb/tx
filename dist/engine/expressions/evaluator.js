// src/engine/expressions/evaluator.ts — Evaluate ExpressionNode ASTs
//
// Implements ExpressionEvaluatorPort: parse + evaluate expression strings
// against an ExpressionContext. Pure function — no side effects, no I/O.
//
// Null propagation: member access on null/undefined returns null rather than
// erroring. This is deliberate — expressions like "cycle.slug" should return
// null when no cycle is active, letting the engine handle the absence.
import { parse } from './parser.js';
import { createBuiltinFunctions } from './functions.js';
// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------
export class ExpressionEvaluator {
    functions;
    constructor(extraFunctions) {
        this.functions = createBuiltinFunctions();
        if (extraFunctions) {
            for (const [name, fn] of extraFunctions) {
                this.functions.set(name, fn);
            }
        }
    }
    evaluate(expression, context) {
        const parseResult = parse(expression);
        if (!parseResult.ok)
            return parseResult;
        return this.evalNode(parseResult.node, context);
    }
    validate(expression) {
        const result = parse(expression);
        if (result.ok)
            return { valid: true };
        return { valid: false, error: result.error };
    }
    // ---------------------------------------------------------------------------
    // Node evaluation — recursive dispatch on node.kind
    // ---------------------------------------------------------------------------
    evalNode(node, ctx) {
        switch (node.kind) {
            case 'literal':
                return { ok: true, value: node.value };
            case 'identifier':
                return this.evalIdentifier(node.name, ctx);
            case 'member':
                return this.evalMember(node, ctx);
            case 'call':
                return this.evalCall(node, ctx);
            case 'binary':
                return this.evalBinary(node, ctx);
            case 'unary':
                return this.evalUnary(node, ctx);
        }
    }
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
    evalIdentifier(name, ctx) {
        if (name in ctx) {
            const value = ctx[name];
            return { ok: true, value: this.toJson(value) };
        }
        return { ok: true, value: null };
    }
    /**
     * Evaluate member access: obj.property
     *
     * Null propagation: if the object evaluates to null, return null.
     * This avoids runtime errors when optional context (like cycle) is absent.
     */
    evalMember(node, ctx) {
        const objResult = this.evalNode(node.object, ctx);
        if (objResult.ok !== true)
            return objResult;
        const obj = objResult.value;
        // Null propagation — accessing a property on null returns null
        if (obj === null)
            return { ok: true, value: null };
        if (typeof obj !== 'object' || Array.isArray(obj)) {
            // Accessing a property on a non-object primitive — return null
            // rather than error, consistent with null propagation philosophy
            return { ok: true, value: null };
        }
        const val = obj[node.property];
        // val could be undefined if the property doesn't exist (noUncheckedIndexedAccess)
        if (val === undefined)
            return { ok: true, value: null };
        return { ok: true, value: val };
    }
    /**
     * Evaluate function calls.
     *
     * The callee is resolved by name from the function registry.
     * Member-style calls like `artifacts.exists('foo')` are NOT supported in v1 —
     * we only support top-level function calls. Member access on the callee is
     * handled by the parser as `Call(Member(...), args)` but the evaluator needs
     * a function name string, so we extract it from the AST.
     */
    evalCall(node, ctx) {
        // Resolve function name from the callee AST node
        const name = this.resolveFunctionName(node.callee);
        if (!name) {
            return { ok: false, error: 'Function call requires a named callee' };
        }
        const fn = this.functions.get(name);
        if (!fn) {
            return { ok: false, error: `Unknown function: ${name}` };
        }
        // Evaluate all arguments — propagate errors and paused results upward
        const args = [];
        for (const argNode of node.args) {
            const result = this.evalNode(argNode, ctx);
            if (result.ok !== true)
                return result;
            args.push(result.value);
        }
        return fn(...args);
    }
    /**
     * Extract a function name from a callee AST node.
     *
     * Supports:
     * - IdentifierNode: `defined(x)` → "defined"
     * - MemberNode: `ns.fn(x)` → "ns.fn" (dot-joined)
     *
     * Returns null for other node kinds (e.g., CallNode — no currying).
     */
    resolveFunctionName(node) {
        if (node.kind === 'identifier')
            return node.name;
        if (node.kind === 'member') {
            const objName = this.resolveFunctionName(node.object);
            if (!objName)
                return null;
            return `${objName}.${node.property}`;
        }
        return null;
    }
    /**
     * Evaluate binary operations with short-circuit semantics for and/or.
     *
     * Comparison uses JSON-level equality (==, !=) and numeric ordering (<, <=, >, >=).
     * Non-numeric operands to ordering comparisons return false rather than erroring,
     * consistent with the "return values, don't throw" philosophy.
     */
    evalBinary(node, ctx) {
        // Short-circuit: evaluate left first for and/or.
        // Paused results propagate upward like errors — if a sub-expression needs
        // user input, the entire expression pauses. But short-circuit semantics
        // still apply: "false and confirm('x')" never reaches confirm.
        if (node.op === 'and') {
            const left = this.evalNode(node.left, ctx);
            if (left.ok !== true)
                return left;
            if (!isTruthy(left.value))
                return { ok: true, value: false };
            const right = this.evalNode(node.right, ctx);
            if (right.ok !== true)
                return right;
            return { ok: true, value: isTruthy(right.value) };
        }
        if (node.op === 'or') {
            const left = this.evalNode(node.left, ctx);
            if (left.ok !== true)
                return left;
            if (isTruthy(left.value))
                return { ok: true, value: true };
            const right = this.evalNode(node.right, ctx);
            if (right.ok !== true)
                return right;
            return { ok: true, value: isTruthy(right.value) };
        }
        // Non-short-circuit: evaluate both sides
        const left = this.evalNode(node.left, ctx);
        if (left.ok !== true)
            return left;
        const right = this.evalNode(node.right, ctx);
        if (right.ok !== true)
            return right;
        switch (node.op) {
            case 'eq':
                return { ok: true, value: jsonEqual(left.value, right.value) };
            case 'neq':
                return { ok: true, value: !jsonEqual(left.value, right.value) };
            case 'lt':
                return { ok: true, value: numericCompare(left.value, right.value, (a, b) => a < b) };
            case 'lte':
                return { ok: true, value: numericCompare(left.value, right.value, (a, b) => a <= b) };
            case 'gt':
                return { ok: true, value: numericCompare(left.value, right.value, (a, b) => a > b) };
            case 'gte':
                return { ok: true, value: numericCompare(left.value, right.value, (a, b) => a >= b) };
            default:
                return { ok: false, error: `Unknown binary operator: ${node.op}` };
        }
    }
    evalUnary(node, ctx) {
        const result = this.evalNode(node.operand, ctx);
        if (result.ok !== true)
            return result;
        return { ok: true, value: !isTruthy(result.value) };
    }
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
    toJson(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((v) => this.toJson(v));
        }
        if (typeof value === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(value)) {
                // Skip function properties — they're not JSON-serializable and are
                // accessed via the function call mechanism instead
                if (typeof v !== 'function') {
                    result[k] = this.toJson(v);
                }
            }
            return result;
        }
        // Fallback for symbols, bigints, etc. — shouldn't appear in practice
        return null;
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Truthiness for expression values.
 *
 * Follows JavaScript semantics with one exception: empty arrays and objects
 * are truthy (unlike some languages). This matches user expectations — if
 * `tasks` exists as an empty array, it's "present" even if empty.
 */
function isTruthy(value) {
    if (value === null)
        return false;
    if (value === false)
        return false;
    if (value === 0)
        return false;
    if (value === '')
        return false;
    return true;
}
/**
 * Deep equality for Json values.
 *
 * Uses JSON serialization for structural comparison of objects/arrays.
 * Short-circuits for primitives.
 */
function jsonEqual(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (typeof a !== typeof b)
        return false;
    if (typeof a !== 'object')
        return false;
    return JSON.stringify(a) === JSON.stringify(b);
}
/**
 * Numeric comparison — returns false if either operand is non-numeric.
 *
 * We don't error on non-numeric comparisons because expressions might be
 * evaluated against incomplete contexts where a value is null or a string.
 * Returning false keeps the engine running without false positives.
 */
function numericCompare(a, b, cmp) {
    if (typeof a !== 'number' || typeof b !== 'number')
        return false;
    return cmp(a, b);
}
//# sourceMappingURL=evaluator.js.map