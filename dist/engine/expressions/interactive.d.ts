import type { ExprFn } from './functions.js';
import { ExpressionEvaluator } from './evaluator.js';
/**
 * Create a Map of interactive expression functions.
 *
 * Returns a new Map each time (same pattern as createBuiltinFunctions)
 * so callers can extend without mutation.
 */
export declare function createInteractiveFunctions(): Map<string, ExprFn>;
/**
 * Create an ExpressionEvaluator with both built-in and interactive functions.
 *
 * Convenience factory for contexts where interactive expressions are expected
 * (e.g., step condition evaluation in the engine). Non-interactive contexts
 * (e.g., config validation) should use the base ExpressionEvaluator instead.
 */
export declare function createInteractiveEvaluator(): ExpressionEvaluator;
//# sourceMappingURL=interactive.d.ts.map