/**
 * Dependency tracking — builds "read first" lists for skills
 * based on which shared modules their extracted functions reference.
 */

/** Map of module path → functions it exports that skills might reference. */
const SHARED_MODULES: Record<string, string[]> = {
  "src/config/resolve.ts": ["resolveConfig", "getPrimaryStrategy", "getActiveStrategies"],
  "src/config/defaults.ts": ["defaults"],
  "src/config/merge.ts": ["deepMerge"],
  "src/state/machine.ts": ["advanceState", "nextStep", "createInitialState", "getEffectiveSteps", "PIPELINE_ORDER"],
  "src/state/status.ts": ["toNimbalystStatus", "inferPlanType", "toTrackerStatus", "calculateProgress"],
  "src/strategies/paths.ts": ["getArtifactPaths", "objectiveDir", "getAllArtifactPaths"],
  "src/strategies/writer.ts": ["writeResearch", "writeRequirements", "writeIssuesAndPlan", "ResearchAgent", "WriteOptions"],
  "src/strategies/worktree.ts": ["getWorktreePaths", "getWorktreeCommands"],
  "src/pipeline/routing.ts": ["parseProvider", "shouldPause", "hasConfigChange", "getPhaseSettings"],
  "src/pipeline/dispatch.ts": ["dispatchPhase", "forEachStrategy"],
};

/**
 * Given a list of source files that a skill extracts from,
 * determine which shared modules Claude should read first.
 *
 * A shared module is "needed" if any function it exports is
 * called or referenced in the extracted source files.
 */
export function resolveReadFirst(
  extractedFiles: string[],
  extractedContent: string,
): string[] {
  const needed = new Set<string>();

  for (const [modulePath, exports] of Object.entries(SHARED_MODULES)) {
    // Don't list a module if the skill already extracts from it
    if (extractedFiles.includes(modulePath)) continue;

    // Check if any of its exports are referenced in the extracted content
    for (const name of exports) {
      if (extractedContent.includes(name)) {
        needed.add(modulePath);
        break;
      }
    }
  }

  return [...needed].sort();
}

/**
 * Format the "read first" list as a markdown instruction.
 */
export function formatReadFirst(modules: string[]): string {
  if (modules.length === 0) return "";
  return [
    "**Read first:** These source files contain shared functions referenced below:",
    ...modules.map(m => `- \`${m}\``),
    "",
  ].join("\n");
}
