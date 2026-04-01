/**
 * Step evaluator — computes StepEvaluation[] for all steps in a lane.
 *
 * Each step is evaluated against its requires (artifacts) and exit_when (predicates).
 * The current active step is "active"; completed steps are "complete"; blocked steps are "blocked".
 */

import type { LaneConfig, StepConfig } from "../../types/config.js";
import type { StepEvaluation, StepStatus } from "../../types/engine.js";
import { allArtifactsSatisfied, missingArtifacts } from "./artifacts.js";
import { evaluateAllPredicates, failingPredicates } from "./predicates.js";
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
export function evaluateSteps(
  lane: LaneConfig,
  epicDir: string,
  ctx: PredicateContext,
): StepEvaluation[] {
  let foundActive = false;

  return lane.steps.map((step: StepConfig): StepEvaluation => {
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

    // This is the active or blocked step
    foundActive = true;
    const requires = step.requires ?? [];
    const missing: string[] = [];

    if (!allArtifactsSatisfied(epicDir, requires)) {
      missing.push(...missingArtifacts(epicDir, requires).map((a) => a.path));
    }

    if (exitPredicates.length > 0) {
      const failing = failingPredicates(exitPredicates, ctx);
      missing.push(...failing);
    }

    const status: StepStatus = missing.length > 0 ? "blocked" : "active";

    return {
      step: step.name,
      lane: lane.name,
      status,
      satisfied: status === "active",
      missing: missing.length > 0 ? missing : undefined,
    };
  });
}

/**
 * Return the name of the currently active step, or null if all steps are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export function activeStep(evaluations: StepEvaluation[]): string | null {
  const active = evaluations.find((e) => e.status === "active" || e.status === "blocked");
  return active?.step ?? null;
}

/**
 * Return true when all steps in the lane are complete.
 *
 * @param evaluations - Step evaluations from evaluateSteps().
 */
export function laneComplete(evaluations: StepEvaluation[]): boolean {
  return evaluations.every((e) => e.status === "complete");
}
