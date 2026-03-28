/**
 * Post-execution delegation — code review, QA, ship.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { parseProvider } from "../pipeline/routing.js";
import { advanceState } from "../state/machine.js";

/**
 * Delegate code review to the configured provider.
 *
 * If review_frequency is "after-all": review all changes on the objective branch.
 * If reviews already ran per-group, this is a final holistic review.
 */
export function executeCodeReview(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
): ObjectiveState {
  const { provider, fallback } = config.pipeline.code_review;

  if (provider === "skip") {
    return advanceState(state, config.pipeline);
  }

  // e.g. "superpowers:requesting-code-review", "gstack:/review",
  //      "nimbalyst:branch-reviewer", "built-in"
  const parsed = parseProvider(provider);
  invoke(provider, fallback);

  // Handoff: display config.strings.handoff_messages.review_to_ship
  return advanceState(state, config.pipeline, provider);
}

/**
 * Delegate QA to the configured provider.
 */
export function executeQA(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { provider, fallback } = config.pipeline.qa;

  if (provider === "skip") {
    return advanceState(state, config.pipeline);
  }

  // e.g. "gstack:/qa"
  invoke(provider, fallback);

  return advanceState(state, config.pipeline, provider);
}

/**
 * Execute the ship step.
 *
 * Built-in implementation:
 *   1. Generate changelog entry using config.strings.changelog_entry template
 *   2. Write changelog at config.files.changelog path
 *      (prepend if newest-first, append if oldest-first)
 *   3. Merge objective branch into main
 *   4. Clean up objective worktree
 *   5. Delete objective branch
 *   6. Move objective folder to done lane (if folders enabled)
 *   7. Commit using config.strings.commit_messages.done
 *
 * Delegated: invoke external provider (e.g. "gstack:/ship")
 */
export function executeShip(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
): ObjectiveState {
  const { provider, fallback } = config.pipeline.ship;

  if (provider === "skip") {
    return advanceState(state, config.pipeline);
  }

  if (provider !== "built-in") {
    invoke(provider, fallback);
    return advanceState(state, config.pipeline, provider);
  }

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
