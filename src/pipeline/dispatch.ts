/**
 * Shared dispatch patterns used by all sub-skills.
 * Extracted here so sub-skills reference one function instead of repeating the pattern.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import type { DelegatablePhase } from "../../types/pipeline.js";
import { parseProvider } from "./routing.js";
import { advanceState } from "../state/machine.js";

/**
 * Check a delegatable phase's provider and dispatch accordingly.
 *
 * Returns: { action, newState }
 *   action === "skip"     → phase skipped, state advanced
 *   action === "delegate" → invoke the parsed provider, state advanced
 *   action === "built-in" → caller should execute built-in logic, then call advanceState
 */
export function dispatchPhase(
  phase: DelegatablePhase,
  config: TwistedConfig,
  state: ObjectiveState,
): { action: "skip" | "delegate" | "built-in"; newState: ObjectiveState; provider?: string } {
  const { provider, fallback } = config.pipeline[phase];

  if (provider === "skip") {
    return { action: "skip", newState: advanceState(state, config.pipeline) };
  }

  if (provider !== "built-in") {
    // Delegate to external provider
    // parseProvider(provider) → { type, command?, skill? }
    // If unavailable, try fallback
    invoke(provider, fallback);
    return { action: "delegate", newState: advanceState(state, config.pipeline, provider), provider };
  }

  return { action: "built-in", newState: state };
}

/**
 * Write artifacts for ALL active tracking strategies.
 * Shared loop used by scope, decompose, and execute steps.
 */
export function forEachStrategy(
  config: TwistedConfig,
  writer: (strategy: string) => void,
): void {
  for (const strategy of config.tracking) {
    writer(strategy);
  }
}
