/**
 * Architecture review — delegation only (no built-in implementation).
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { parseProvider } from "../pipeline/routing.js";
import { advanceState } from "../state/machine.js";

/**
 * Execute the arch_review step.
 * This step has no built-in implementation — it is always delegated or skipped.
 */
export function executeArchReview(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { provider, fallback } = config.pipeline.arch_review;

  if (provider === "skip") {
    return advanceState(state, config.pipeline);
  }

  // Delegate to external provider
  // e.g. "gstack:/plan-eng-review" → invoke gstack engineering review
  const parsed = parseProvider(provider);
  invoke(provider, fallback);

  return advanceState(state, config.pipeline, provider);
}
