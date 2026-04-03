/**
 * Dependency tracking — builds "read first" lists for skills
 * based on which shared modules and types their extracted functions reference.
 */

/** Map of module path → names it exports that skills might reference. */
const SHARED_MODULES: Record<string, string[]> = {
  "src/config/resolve.ts": ["resolveConfig"],
  "src/config/defaults.ts": ["DEFAULT_CONFIG"],
  "src/config/validator.ts": ["validateConfig"],
  "src/engine/state.ts": ["txNext"],
  "src/engine/dag.ts": ["resolveDag"],
  "src/engine/evaluate.ts": ["evaluateSteps"],
  "src/issues/crud.ts": ["createIssue", "getIssueBySlug", "listIssues", "updateIssue", "closeIssue"],
  "src/cycles/lifecycle.ts": ["startCycle", "pullIssues", "closeCycle"],
};

/** Map of type definition files → type names they export. */
const TYPE_FILES: Record<string, string[]> = {
  "src/types/issue.ts": ["Issue", "IssueId", "IssueType", "IssueStatus", "Json"],
  "src/types/cycle.ts": ["Cycle", "CycleId", "CycleStatus", "CycleIssue"],
  "src/types/workflow.ts": ["Workflow", "WorkflowId", "StepDef", "StepArtifact"],
  "src/types/config.ts": ["TwistedConfig", "TwistedSettings", "ValidConfig", "WorkflowConfig", "DeepPartial"],
  "src/types/protocol.ts": ["DaemonRequest", "DaemonResponse", "AgentResponse", "AgentAction", "IssueState"],
  "src/types/expressions.ts": ["ExpressionNode", "ExpressionContext", "EvalResult"],
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
