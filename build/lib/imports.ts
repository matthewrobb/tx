/**
 * Dependency tracking — builds "read first" lists for skills
 * based on which shared modules and types their extracted functions reference.
 */

/** Map of module path → names it exports that skills might reference. */
const SHARED_MODULES: Record<string, string[]> = {
  "src/config/resolve.ts": ["resolveConfig", "getPrimaryStrategy", "getActiveStrategies"],
  "src/config/defaults.ts": ["defaults"],
  "src/config/merge.ts": ["deepMerge"],
  "src/state/machine.ts": ["advanceState", "nextStep", "createInitialState", "getEffectiveSteps", "PIPELINE_ORDER"],
  "src/strategies/worktree.ts": ["getWorktreePaths", "getWorktreeCommands"],
  "src/pipeline/routing.ts": ["parseProvider", "shouldPause", "hasConfigChange", "getPhaseSettings"],
  "src/pipeline/dispatch.ts": ["dispatchPhase"],
};

/** Map of type definition files → type names they export. */
const TYPE_FILES: Record<string, string[]> = {
  "src/types/config.d.ts": ["TwistedConfig", "TwistedSettings", "ArtifactRef", "PredicateRef", "StepConfig", "LaneConfig", "DeepPartial"],
  "src/types/state.d.ts": ["CoreState", "EpicStatus"],
  "src/types/commands.d.ts": ["ParsedCommand", "TwistedSubcommand", "ConfigSection", "ConfigParams"],
  "src/types/engine.d.ts": ["EngineResult", "StepEvaluation", "StepStatus"],
  "src/types/epic.d.ts": ["EpicType", "TypeConfig"],
  "src/types/notes.d.ts": ["Note", "NoteType", "RetroNote", "BacklogCandidate"],
  "src/types/tasks.d.ts": ["Task"],
  "src/types/session.d.ts": ["ActiveSession", "SessionData", "SessionSummary"],
};

/**
 * Given a list of source files that a skill extracts from,
 * determine which shared modules and type files Claude should read first.
 *
 * A module/type file is "needed" if any name it exports is
 * referenced in the extracted content.
 */
export function resolveReadFirst(
  extractedFiles: string[],
  extractedContent: string,
): string[] {
  const needed = new Set<string>();

  // Check shared runtime modules
  for (const [modulePath, exports] of Object.entries(SHARED_MODULES)) {
    if (extractedFiles.includes(modulePath)) continue;
    for (const name of exports) {
      if (extractedContent.includes(name)) {
        needed.add(modulePath);
        break;
      }
    }
  }

  // Check type definition files
  for (const [typePath, typeNames] of Object.entries(TYPE_FILES)) {
    for (const name of typeNames) {
      if (extractedContent.includes(name)) {
        needed.add(typePath);
        break;
      }
    }
  }

  // Sort: types first, then src modules
  return [...needed].sort((a, b) => {
    const aIsType = a.startsWith("src/types/");
    const bIsType = b.startsWith("src/types/");
    if (aIsType && !bIsType) return -1;
    if (!aIsType && bIsType) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Format the "read first" list as a markdown instruction.
 */
export function formatReadFirst(modules: string[]): string {
  if (modules.length === 0) return "";

  const types = modules.filter(m => m.startsWith("src/types/"));
  const src = modules.filter(m => m.startsWith("src/") && !m.startsWith("src/types/"));

  const lines = ["**Read first:**"];
  if (types.length > 0) {
    lines.push("Types: " + types.map(m => `\`${m}\``).join(", "));
  }
  if (src.length > 0) {
    lines.push("Shared logic: " + src.map(m => `\`${m}\``).join(", "));
  }
  lines.push("");

  return lines.join("\n");
}
