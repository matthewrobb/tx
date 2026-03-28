/**
 * Post-execution delegation — code review, QA, ship.
 * All use dispatchPhase for provider check — see using-twisted-workflow.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { dispatchPhase } from "../pipeline/dispatch.js";
import { advanceState } from "../state/machine.js";

/**
 * Delegate code review.
 * review_frequency determines when this runs:
 *   "after-all" → once after all groups (default)
 *   "per-group" → already ran per-group during execute
 *   "risk-based" → already ran for high-complexity groups
 */
export function executeCodeReview(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  // Handoff: display config.strings.handoff_messages.review_to_ship
  const { newState } = dispatchPhase("code_review", config, state);
  return newState;
}

/**
 * Delegate QA.
 */
export function executeQA(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { newState } = dispatchPhase("qa", config, state);
  return newState;
}

/**
 * Execute the ship step.
 *
 * Built-in:
 *   1. Generate changelog using config.strings.changelog_entry template
 *   2. Write to config.files.changelog (prepend if newest-first, append if oldest-first)
 *   3. Merge objective branch into main
 *   4. Clean up objective worktree
 *   5. Move objective folder to done lane (if folders enabled)
 *   6. Commit using config.strings.commit_messages.done
 *
 * Delegated: invoke provider (e.g. "gstack:/ship")
 */
export function executeShip(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
): ObjectiveState {
  const { action, newState } = dispatchPhase("ship", config, state);
  if (action !== "built-in") return newState;

  // Built-in ship
  generateChangelog(config, objective);
  mergeToMain(objective);
  cleanupObjectiveWorktree(config.directories.worktrees, objective);

  if (config.state.use_folders) {
    const date = new Date().toISOString().split("T")[0];
    moveFolder(
      `${config.state.folder_kanban.in_progress}/${objective}`,
      `${config.state.folder_kanban.done}/${objective}-${date}`,
    );
  }

  commitDone(config, objective);

  // Handoff: display config.strings.handoff_messages.ship_done
  return advanceState(state, config.pipeline, "built-in");
}
