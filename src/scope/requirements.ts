/**
 * Requirements writing — strategy-aware output after interrogation.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { advanceState } from "../state/machine.js";
import { writeRequirements } from "../strategies/writer.js";
import { getArtifactPaths } from "../strategies/paths.js";

/**
 * Read research from the primary tracking strategy's location.
 * Falls back gracefully if research was skipped or doesn't exist.
 */
export function readResearchForScope(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): string | null {
  const primaryStrategy = config.tracking[0] ?? "twisted";
  const paths = getArtifactPaths(primaryStrategy, objective, objDir);

  switch (primaryStrategy) {
    case "twisted":
      // Read all RESEARCH-*.md files from objDir
      return readGlob(`${objDir}/RESEARCH-*.md`);
    case "nimbalyst":
      // Read plan doc — research is in Goals + Problem Description sections
      return readFile(`nimbalyst-local/plans/${objective}.md`);
    case "gstack":
      // Read design doc — research is in Vision + Detailed Design sections
      return readFile(`${objDir}/DESIGN.md`);
    default:
      return readGlob(`${objDir}/RESEARCH-*.md`);
  }
}

/**
 * Write requirements and advance state.
 * Writes for ALL active tracking strategies.
 */
export function writeAndAdvance(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,
): ObjectiveState {
  // Write for ALL active tracking strategies
  for (const strategy of config.tracking) {
    writeRequirements(strategy, objective, objDir, categories, {
      nimbalystConfig: config.nimbalyst,
    });
  }

  // Handoff: display config.strings.handoff_messages.scope_to_decompose
  return advanceState(state, config.pipeline, "built-in");
}
