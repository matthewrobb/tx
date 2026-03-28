/**
 * Architecture review — delegation only (no built-in implementation).
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { dispatchPhase } from "../pipeline/dispatch.js";

/**
 * Execute the arch_review step.
 * No built-in implementation — always delegated or skipped.
 * Uses dispatchPhase — see using-twisted-workflow for details.
 */
export function executeArchReview(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { newState } = dispatchPhase("arch_review", config, state);
  return newState;
}
