/**
 * Pipeline routing — provider resolution and delegation logic.
 */

import type { PipelineConfig, PhaseProviderConfig, ProviderString, DelegatablePhase } from "../../types/pipeline.js";
import type { PhaseSettings, PhasesConfig } from "../../types/phases.js";
import type { FlowConfig } from "../../types/flow.js";
import type { ObjectiveStep } from "../../types/state.js";

/** Result of resolving a provider for a delegatable phase. */
export interface ResolvedProvider {
  /** The provider string to invoke. */
  provider: ProviderString;
  /** Whether this is the fallback (primary was unavailable). */
  isFallback: boolean;
  /** The phase config that was resolved. */
  config: PhaseProviderConfig;
}

/**
 * Parse a provider string into its components.
 *
 * "built-in" → { type: "built-in" }
 * "skip" → { type: "skip" }
 * "ask" → { type: "ask" }
 * "gstack:/review" → { type: "gstack", command: "/review" }
 * "superpowers:test-driven-development" → { type: "superpowers", skill: "test-driven-development" }
 * "nimbalyst:deep-researcher" → { type: "nimbalyst", skill: "deep-researcher" }
 */
export function parseProvider(provider: ProviderString): {
  type: string;
  command?: string;
  skill?: string;
} {
  if (provider === "built-in" || provider === "skip" || provider === "ask") {
    return { type: provider };
  }

  const colonIdx = provider.indexOf(":");
  if (colonIdx === -1) return { type: provider };

  const type = provider.slice(0, colonIdx);
  const rest = provider.slice(colonIdx + 1);

  if (type === "gstack") return { type, command: rest };
  return { type, skill: rest };
}

/**
 * Get the provider config for a delegatable phase.
 */
export function getPhaseProvider(
  phase: DelegatablePhase,
  pipeline: PipelineConfig,
): PhaseProviderConfig {
  return pipeline[phase];
}

// ---------------------------------------------------------------------------
// Flow control
// ---------------------------------------------------------------------------

/** Map core steps to their phase settings key. */
const STEP_TO_PHASE: Partial<Record<ObjectiveStep, keyof PhasesConfig>> = {
  scope: "scope",
  decompose: "decompose",
  execute: "execute",
};

/**
 * Get the phase settings for a step.
 * Delegatable steps inherit from the step that invokes them.
 * Returns null for steps without specific phase settings.
 */
export function getPhaseSettings(
  step: ObjectiveStep,
  phases: PhasesConfig,
): PhaseSettings | null {
  const key = STEP_TO_PHASE[step];
  if (!key) return null;
  return phases[key];
}

/**
 * Check if there's a config change between two steps that should trigger a pause.
 */
export function hasConfigChange(
  fromStep: ObjectiveStep,
  toStep: ObjectiveStep,
  phases: PhasesConfig,
): boolean {
  const from = getPhaseSettings(fromStep, phases);
  const to = getPhaseSettings(toStep, phases);

  if (!from || !to) return false;

  return (
    from.model !== to.model ||
    from.effort !== to.effort ||
    from.context !== to.context ||
    from.mode !== to.mode
  );
}

/** Reasons the pipeline pauses. */
export type PauseReason = "config_change" | "low_context" | "user_requested" | "step_complete" | "error";

/**
 * Determine if the pipeline should pause before advancing to the next step.
 * Returns the pause reason, or null if no pause is needed.
 */
export function shouldPause(
  fromStep: ObjectiveStep,
  toStep: ObjectiveStep,
  flow: FlowConfig,
  phases: PhasesConfig,
  yolo: boolean,
): PauseReason | null {
  if (yolo) return null;

  if (!flow.auto_advance) return "user_requested";

  if (flow.pause_on_config_change && hasConfigChange(fromStep, toStep, phases)) {
    return "config_change";
  }

  // pause_on_low_context is checked at runtime (context window utilization)
  // — can't evaluate statically, so we return null here and let the
  // runtime check handle it.

  return null;
}
