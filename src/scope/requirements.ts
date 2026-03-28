/**
 * Requirements writing — strategy-aware output after interrogation.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { forEachStrategy } from "../pipeline/dispatch.js";
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
      return readGlob(`${objDir}/RESEARCH-*.md`);
    case "nimbalyst":
      // Plan doc — research is in Goals + Problem Description sections
      return readFile(`nimbalyst-local/plans/${objective}.md`);
    case "gstack":
      // Design doc — research is in Vision + Detailed Design sections
      return readFile(`${objDir}/DESIGN.md`);
    default:
      return readGlob(`${objDir}/RESEARCH-*.md`);
  }
}

/**
 * Write requirements and advance state.
 * Uses forEachStrategy — see using-twisted-workflow for the shared pattern.
 */
export function writeAndAdvance(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,
): ObjectiveState {
  forEachStrategy(config, (strategy) => {
    writeRequirements(strategy, objective, objDir, categories, {
      nimbalystConfig: config.nimbalyst,
    });
  });

  // Handoff: display config.strings.handoff_messages.scope_to_decompose
  return advanceState(state, config.pipeline, "built-in");
}
