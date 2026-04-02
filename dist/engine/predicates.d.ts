/**
 * Predicate evaluator — named boolean conditions used in step exit_when and lane entry_requires.
 *
 * Built-in predicates:
 *   artifact.exists   — file exists at the given path
 *   tasks.all_done    — all tasks in tasks.json are marked done
 *   lane.exists       — the given lane directory exists under .twisted/
 */
import type { PredicateRef } from "../types/index.js";
/** Context passed to every predicate. */
export interface PredicateContext {
    /** Absolute path to the epic's current lane directory. */
    epicDir: string;
    /** Absolute path to the .twisted/ root. */
    twistedRoot: string;
}
/**
 * Evaluate a single predicate reference.
 *
 * @param predicate - The predicate to evaluate.
 * @param ctx - Evaluation context (epicDir, twistedRoot).
 * @returns True if the predicate passes, false otherwise.
 */
export declare function evaluatePredicate(predicate: PredicateRef, ctx: PredicateContext): boolean;
/**
 * Evaluate a list of predicates — all must pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export declare function evaluateAllPredicates(predicates: PredicateRef[], ctx: PredicateContext): boolean;
/**
 * Return the names of predicates that do NOT pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export declare function failingPredicates(predicates: PredicateRef[], ctx: PredicateContext): string[];
//# sourceMappingURL=predicates.d.ts.map