/**
 * State machine — step sequencing, transitions, and skip logic.
 */

import type { ObjectiveStep, ObjectiveStatus, ObjectiveState } from "../../types/state.js";
import type { PipelineConfig } from "../../types/pipeline.js";

/**
 * Full pipeline step sequence in execution order.
 * Delegatable steps may be skipped based on provider config.
 */
export const PIPELINE_ORDER: readonly ObjectiveStep[] = [
  "research",
  "scope",
  "plan",
  "build",
  "close",
] as const;

/** Core steps that twisted-workflow always owns. */
export const CORE_STEPS: readonly ObjectiveStep[] = [
  "scope",
  "plan",
  "build",
  "close",
] as const;

/** Delegatable steps that can be routed to external providers. */
export const DELEGATABLE_STEPS: readonly ObjectiveStep[] = [
  "research",
] as const;

/**
 * Check if a step is skipped based on pipeline config.
 * A delegatable step is skipped when its provider is "skip".
 */
export function isStepSkipped(
  step: ObjectiveStep,
  pipeline: PipelineConfig,
): boolean {
  if (step !== "research") return false;
  return pipeline.research?.provider === "skip";
}

/**
 * Get the effective step sequence with skipped steps removed.
 */
export function getEffectiveSteps(pipeline: PipelineConfig): ObjectiveStep[] {
  return PIPELINE_ORDER.filter((step) => !isStepSkipped(step, pipeline));
}

/**
 * Get the next step after the current one, skipping any that are configured as "skip".
 * Returns null if the current step is the last one.
 */
export function nextStep(
  current: ObjectiveStep,
  pipeline: PipelineConfig,
): ObjectiveStep | null {
  const effective = getEffectiveSteps(pipeline);
  const idx = effective.indexOf(current);
  if (idx === -1 || idx >= effective.length - 1) return null;
  return effective[idx + 1]!;
}

/**
 * Get the steps remaining after a given step (exclusive of current).
 */
export function stepsRemaining(
  current: ObjectiveStep,
  pipeline: PipelineConfig,
): ObjectiveStep[] {
  const effective = getEffectiveSteps(pipeline);
  const idx = effective.indexOf(current);
  if (idx === -1) return [];
  return effective.slice(idx + 1);
}

/**
 * Get the steps completed up to (but not including) the current step.
 */
export function stepsCompleted(
  current: ObjectiveStep,
  pipeline: PipelineConfig,
): ObjectiveStep[] {
  const effective = getEffectiveSteps(pipeline);
  const idx = effective.indexOf(current);
  if (idx === -1) return [];
  return effective.slice(0, idx);
}

/**
 * Determine the objective status based on the current step.
 */
export function statusForStep(step: ObjectiveStep): ObjectiveStatus {
  switch (step) {
    case "research":
    case "scope":
    case "plan":
      return "todo";
    case "build":
      return "in-progress";
    case "close":
      return "in-progress";
    default:
      return "todo";
  }
}

/**
 * Check if a step transition should trigger a status change.
 */
export function shouldChangeStatus(
  fromStep: ObjectiveStep,
  toStep: ObjectiveStep,
): boolean {
  return statusForStep(fromStep) !== statusForStep(toStep);
}

/**
 * Create the initial ObjectiveState for a new objective.
 */
export function createInitialState(
  objective: string,
  pipeline: PipelineConfig,
): ObjectiveState {
  const effective = getEffectiveSteps(pipeline);
  const firstStep = effective[0] ?? "scope";

  return {
    objective,
    status: "todo",
    step: firstStep,
    steps_completed: [],
    steps_remaining: effective.slice(1),
    group_current: null,
    groups_total: null,
    tasks_done: 0,
    tasks_total: null,
    created: new Date().toISOString().split("T")[0]!,
    updated: new Date().toISOString(),
    notes: null,
  };
}

/**
 * Advance the state to the next step.
 * Returns a new state object (immutable).
 */
export function advanceState(
  state: ObjectiveState,
  pipeline: PipelineConfig,
  provider?: string,
): ObjectiveState {
  const next = nextStep(state.step, pipeline);

  if (!next) {
    // Final step complete — mark as done
    return {
      ...state,
      status: "done",
      steps_completed: [...state.steps_completed, state.step],
      steps_remaining: [],
      updated: new Date().toISOString(),
    };
  }

  const newStatus = statusForStep(next);

  return {
    ...state,
    status: newStatus,
    step: next,
    steps_completed: [...state.steps_completed, state.step],
    steps_remaining: stepsRemaining(next, pipeline),
    updated: new Date().toISOString(),
  };
}
