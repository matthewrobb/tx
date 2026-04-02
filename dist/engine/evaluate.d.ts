/**
 * Step evaluator — computes StepEvaluation[] for all steps in a lane.
 *
 * Each step is evaluated against its requires (artifacts) and exit_when (predicates).
 * The current active step is "active"; completed steps are "complete"; blocked steps are "blocked".
 */
import type { LaneConfig, StepEvaluation } from "../types/index.js";
import type { PredicateContext } from "./predicates.js";
/**
 * Evaluate all steps in a lane and return their status.
 *
 * Algorithm:
 * - Walk steps in order.
 * - A step is "complete" when its exit_when predicates all pass.
 * - The first non-complete step is "active" if its requires are met, else "blocked".
 * - Steps after the first non-complete step are "pending".
 *
 * @param lane - The lane configuration containing steps.
 * @param epicDir - Absolute path to the epic's current lane directory.
 * @param ctx - Predicate evaluation context.
 */
export declare function evaluateSteps(lane: LaneConfig, epicDir: string, ctx: PredicateContext): StepEvaluation[];
/**
 * Return the name of the currently active step, or null if all steps are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export declare function activeStep(evaluations: StepEvaluation[]): string | null;
/**
 * Return true when all steps in the lane are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export declare function laneComplete(evaluations: StepEvaluation[]): boolean;
//# sourceMappingURL=evaluate.d.ts.map