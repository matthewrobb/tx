import type { Json } from '../../types/issue.js';
import type { EvalResult } from '../../types/expressions.js';
export type ExprFn = (...args: Json[]) => EvalResult;
/**
 * Create the default set of built-in functions.
 *
 * Returns a new Map each time so callers can extend without mutating a shared
 * registry (important for testability and plugin isolation).
 */
export declare function createBuiltinFunctions(): Map<string, ExprFn>;
//# sourceMappingURL=functions.d.ts.map