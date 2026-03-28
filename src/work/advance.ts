/**
 * Auto-advance logic — next, resume, and step dispatch.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { nextStep, advanceState } from "../state/machine.js";
import { shouldPause, getPhaseSettings } from "../pipeline/routing.js";

/**
 * Execute /twisted-work next — advance to the next step.
 *
 * 1. Find the most recently updated objective (or use named objective)
 * 2. Read state.md to get current ObjectiveState
 * 3. Determine next step, skipping delegatable steps with provider: "skip"
 * 4. Check pause conditions (unless --yolo):
 *      - config.flow.auto_advance === false → always pause
 *      - config.flow.pause_on_config_change → pause if next step has different model/effort/context/mode
 *      - config.flow.pause_on_low_context → pause if context window is high
 * 5. Show phase recommendation if pausing:
 *      config.strings.phase_recommendation with {step}, {model}, {effort}, {context}, {mode}
 * 6. Load the sub-skill for the next step:
 *      research, scope → twisted-scope
 *      arch_review     → delegate to pipeline provider
 *      decompose       → twisted-decompose
 *      execute         → twisted-execute
 *      code_review, qa, ship → delegate to pipeline provider
 * 7. After step completes, loop back (auto-advance) unless paused
 */
export function executeNext(
  config: TwistedConfig,
  state: ObjectiveState,
  yolo: boolean,
): void {
  let currentState = state;

  while (true) {
    const next = nextStep(currentState.step, config.pipeline);
    if (!next) break; // all steps complete

    // Check pause conditions
    const pauseReason = shouldPause(
      currentState.step,
      next,
      config.flow,
      config.phases,
      yolo,
    );

    if (pauseReason) {
      // Show phase recommendation
      const settings = getPhaseSettings(next, config.phases);
      if (settings) {
        const rec = config.strings.phase_recommendation
          .replace("{step}", next)
          .replace("{model}", settings.model)
          .replace("{effort}", settings.effort)
          .replace("{context}", settings.context)
          .replace("{mode}", settings.mode);
        display(rec);
      }

      if (pauseReason === "config_change") {
        display("Settings change — confirm before continuing.");
      } else if (pauseReason === "low_context") {
        display("Context window is high — consider a new session.");
      } else if (pauseReason === "user_requested") {
        display("Auto-advance disabled — confirm to continue.");
      }

      // Wait for user confirmation (unless yolo, which shouldn't reach here)
      waitForConfirmation();
    }

    // Dispatch to appropriate handler
    currentState = dispatchStep(config, currentState, next, yolo);

    // If auto-advance is off and not yolo, pause after each step
    if (!config.flow.auto_advance && !yolo) break;
  }
}

/**
 * Execute /twisted-work resume — resume at the CURRENT step (not next).
 */
export function executeResume(
  config: TwistedConfig,
  state: ObjectiveState,
  yolo: boolean,
): void {
  // Resume at the current step — the one that was in progress when the session ended
  dispatchStep(config, state, state.step, yolo);

  // Then continue with auto-advance
  executeNext(config, state, yolo);
}
