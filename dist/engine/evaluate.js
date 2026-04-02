/**
 * Step evaluator — computes StepEvaluation[] for all steps in a lane.
 *
 * Each step is evaluated against its requires (artifacts) and exit_when (predicates).
 * The current active step is "active"; completed steps are "complete"; blocked steps are "blocked".
 */
import { allArtifactsSatisfied, missingArtifacts } from "./artifacts.js";
import { evaluateAllPredicates } from "./predicates.js";
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
export function evaluateSteps(lane, epicDir, ctx) {
    let foundActive = false;
    return lane.steps.map((step) => {
        if (foundActive) {
            return {
                step: step.name,
                lane: lane.name,
                status: "pending",
                satisfied: false,
                missing: [],
            };
        }
        // Check exit conditions
        const exitPredicates = step.exit_when ?? [];
        const isComplete = exitPredicates.length > 0
            ? evaluateAllPredicates(exitPredicates, ctx)
            : false;
        if (isComplete) {
            return {
                step: step.name,
                lane: lane.name,
                status: "complete",
                satisfied: true,
            };
        }
        // This is the active or blocked step.
        // "blocked" = entry requirements (requires) not met.
        // "active"  = entry requirements met, step is in progress (exit_when not yet satisfied).
        foundActive = true;
        const requires = step.requires ?? [];
        const missingReqs = allArtifactsSatisfied(epicDir, requires)
            ? []
            : missingArtifacts(epicDir, requires).map((a) => a.path);
        const status = missingReqs.length > 0 ? "blocked" : "active";
        return {
            step: step.name,
            lane: lane.name,
            status,
            satisfied: status === "active",
            missing: missingReqs.length > 0 ? missingReqs : undefined,
        };
    });
}
/**
 * Return the name of the currently active step, or null if all steps are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export function activeStep(evaluations) {
    const active = evaluations.find((e) => e.status === "active" || e.status === "blocked");
    return active?.step ?? null;
}
/**
 * Return true when all steps in the lane are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export function laneComplete(evaluations) {
    return evaluations.every((e) => e.status === "complete");
}
//# sourceMappingURL=evaluate.js.map