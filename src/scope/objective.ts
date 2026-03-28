/**
 * Objective creation — name establishment and initial state.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { createInitialState } from "../state/machine.js";
import { objectiveDir } from "../strategies/paths.js";

/**
 * Establish the objective name and create the objective directory.
 * Called when entering the pipeline without an existing objective.
 */
export function establishObjective(
  config: TwistedConfig,
): { objective: string; objDir: string; state: ObjectiveState } {
  // Ask: "What is the short name for this objective?
  //        Leave blank for auto-suggestions."
  const name = askUser("objective name prompt");

  let objective: string;
  if (name) {
    objective = name;
  } else {
    // Spawn single fast scout agent for minimal codebase scan
    // Suggest 3 names using config.writing quality rules
    const suggestions = suggestNames(3, config.writing);
    objective = askUser(pickFrom(suggestions));
  }

  // Fallback: zero-padded numeric increment
  // e.g. "001", "002" based on total folders across all lanes
  if (!objective) {
    objective = nextIncrementName(config.naming);
  }

  const objDir = objectiveDir(
    objective,
    "todo",
    config.state,
    config.directories,
  );
  createDir(objDir);

  const state = createInitialState(objective, config.pipeline);
  writeStateFrontmatter(objDir, state);

  return { objective, objDir, state };
}
