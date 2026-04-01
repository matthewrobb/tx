/**
 * Issue breakdown — complexity estimation, agent assignment, dependency analysis.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import type { Issue, IssueGroup, DependencyGraph } from "../../types/issues.js";
import { advanceState } from "../state/machine.js";

/**
 * Read research + requirements from the primary tracking strategy's location.
 */
export function readInputsForDecompose(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): { research: string | null; requirements: string | null } {
  return {
    research: readGlob(`${objDir}/RESEARCH-*.md`),
    requirements: readFile(`${objDir}/REQUIREMENTS.md`),
  };
}

/**
 * Estimate complexity for each issue using the configured scale.
 *
 * Scales: "fibonacci" (default: 1,2,3,5,8,13,21), "linear" (1-10),
 *         "tshirt" (XS=1..XXL=13), "custom" (config.decompose.custom_scale)
 *
 * Agent assignment based on thresholds:
 *   complexity <= batch_threshold (default 2)  → "batch"    (group trivial issues into one agent)
 *   complexity >= split_threshold (default 8)  → "split"    (auto-decompose into sub-issues)
 *   otherwise                                  → "standard" (one agent per issue)
 */
export function estimateComplexity(
  issue: Issue,
  config: TwistedConfig,
): Issue {
  const value = estimateValue(issue, config.decompose.estimation);
  const assignment =
    value <= config.decompose.batch_threshold ? "batch" :
    value >= config.decompose.split_threshold ? "split" :
    "standard";

  return { ...issue, complexity: { value, label: String(value), assignment } };
}

/**
 * Break requirements into issues, assign groups, compute dependency graph.
 *
 * Rules:
 *   - Issues within the same group must have NO intra-group dependencies
 *   - Issues in later groups may depend on earlier groups
 *   - Minimize group count to reduce sequential bottlenecks
 *   - "split" issues are auto-decomposed into sub-issues
 *
 * This step uses plan mode (config.phases.decompose.mode === "plan"):
 *   Present the full breakdown for human review BEFORE writing files.
 *   Only write after approval. --yolo skips the review pause.
 */
export function decomposeIntoIssues(
  config: TwistedConfig,
  research: string | null,
  requirements: string | null,
): { issues: Issue[]; groups: IssueGroup[]; graph: DependencyGraph } {
  const rawIssues = breakIntoIssues(requirements, config.templates.issue);
  const issues = rawIssues.map(issue => estimateComplexity(issue, config));
  const groups = computeGroups(issues);
  const graph = buildDependencyGraph(groups);
  return { issues, groups, graph };
}

/**
 * Write decompose output and advance state.
 * Uses forEachStrategy — see using-twisted-workflow for the shared pattern.
 */
export function writeDecomposeOutput(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  issues: Issue[],
  groups: IssueGroup[],
  graph: DependencyGraph,
): ObjectiveState {
  writeIssuesAndPlan(objective, objDir, issues, groups, graph);

  // Handoff: display config.strings.handoff_messages.plan_to_build
  return advanceState(state, config.pipeline, "built-in");
}
