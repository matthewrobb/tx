/**
 * Requirements writing — strategy-aware output after interrogation.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { advanceState } from "../state/machine.js";

/**
 * Read research from the objective directory.
 * Falls back gracefully if research was skipped or doesn't exist.
 */
export function readResearchForScope(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): string | null {
  return readGlob(`${objDir}/RESEARCH-*.md`);
}

/**
 * Write requirements and advance state.
 */
export function writeAndAdvance(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,
): ObjectiveState {
  writeRequirements(objective, objDir, categories);

  // Handoff: display config.strings.handoff_messages.scope_to_plan
  return advanceState(state, config.pipeline, "built-in");
}
