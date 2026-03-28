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
  "src/state/status.ts": ["toNimbalystStatus", "inferPlanType", "toTrackerStatus", "calculateProgress"],
  "src/strategies/paths.ts": ["getArtifactPaths", "objectiveDir", "getAllArtifactPaths"],
  "src/strategies/writer.ts": ["writeResearch", "writeRequirements", "writeIssuesAndPlan", "ResearchAgent", "WriteOptions"],
  "src/strategies/worktree.ts": ["getWorktreePaths", "getWorktreeCommands"],
  "src/pipeline/routing.ts": ["parseProvider", "shouldPause", "hasConfigChange", "getPhaseSettings"],
  "src/pipeline/dispatch.ts": ["dispatchPhase", "forEachStrategy"],
};

/** Map of type definition files → type names they export. */
const TYPE_FILES: Record<string, string[]> = {
  "types/config.d.ts": ["TwistedConfig", "TwistedSettings"],
  "types/state.d.ts": ["ObjectiveState", "ObjectiveStatus", "ObjectiveStep"],
  "types/pipeline.d.ts": ["PipelineConfig", "PhaseProviderConfig", "ProviderString", "DelegatablePhase"],
  "types/execution.d.ts": ["ExecutionConfig", "ExecutionStrategy", "MergeStrategy", "ReviewFrequency", "TestRequirement", "WorktreeTiers"],
  "types/issues.d.ts": ["Issue", "IssueGroup", "DependencyGraph", "ComplexityEstimate", "AgentAssignment"],
  "types/decompose.d.ts": ["DecomposeConfig", "EstimationScale", "ComplexityThresholds"],
  "types/flow.d.ts": ["FlowConfig", "PauseReason"],
  "types/phases.d.ts": ["PhasesConfig", "PhaseSettings", "ModelName", "EffortLevel"],
  "types/tracking.d.ts": ["TrackingStrategy"],
  "types/nimbalyst.d.ts": ["NimbalystConfig", "NimbalystPlanFrontmatter", "NimbalystStatus", "NimbalystPlanType"],
  "types/frontmatter.d.ts": ["ResearchFrontmatter", "RequirementsFrontmatter", "IssuesFrontmatter", "PlanFrontmatter"],
  "types/commands.d.ts": ["ParsedCommand", "TwistedSubcommand", "ConfigSection", "ConfigParams"],
  "types/templates.d.ts": ["IssueTemplate", "IssueField"],
  "types/strings.d.ts": ["StringTemplates", "CommitMessageTemplates", "HandoffMessageTemplates"],
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
    const aIsType = a.startsWith("types/");
    const bIsType = b.startsWith("types/");
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

  const types = modules.filter(m => m.startsWith("types/"));
  const src = modules.filter(m => m.startsWith("src/"));

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
