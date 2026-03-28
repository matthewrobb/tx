/**
 * Issue breakdown — complexity estimation, agent assignment, dependency analysis.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import type { Issue, IssueGroup, DependencyGraph } from "../../types/issues.js";
import { advanceState } from "../state/machine.js";
import { writeIssuesAndPlan } from "../strategies/writer.js";
import { getArtifactPaths } from "../strategies/paths.js";

/**
 * Read research + requirements from the primary tracking strategy's location.
 */
export function readInputsForDecompose(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): { research: string | null; requirements: string | null } {
  const primaryStrategy = config.tracking[0] ?? "twisted";
  const paths = getArtifactPaths(primaryStrategy, objective, objDir);

  switch (primaryStrategy) {
    case "twisted":
      return {
        research: readGlob(`${objDir}/RESEARCH-*.md`),
        requirements: readFile(`${objDir}/REQUIREMENTS.md`),
      };
    case "nimbalyst":
      // Research + requirements are both in the plan doc
      const planDoc = readFile(`nimbalyst-local/plans/${objective}.md`);
      return { research: planDoc, requirements: planDoc };
    case "gstack":
      return {
        research: readFile(`${objDir}/DESIGN.md`),
        requirements: readFile(`${objDir}/DESIGN.md`),
      };
    default:
      return {
        research: readGlob(`${objDir}/RESEARCH-*.md`),
        requirements: readFile(`${objDir}/REQUIREMENTS.md`),
      };
  }
}

/**
 * Estimate complexity for each issue using the configured scale.
 *
 * Scales:
 *   "fibonacci": 1, 2, 3, 5, 8, 13, 21 (default)
 *   linear:    1–10
 *   tshirt:    XS=1, S=2, M=3, L=5, XL=8, XXL=13
 *   custom:    values from config.decompose.custom_scale
 *
 * Agent assignment based on thresholds:
 *   complexity <= batch_threshold (default 2)  → "batch"  (group trivial issues into one agent)
 *   complexity >= split_threshold (default 8)  → "split"  (auto-decompose into sub-issues)
 *   otherwise                                  → "standard" (one agent per issue)
 */
export function estimateComplexity(
  issue: Issue,
  config: TwistedConfig,
): Issue {
  // Estimate complexity value — judgment call based on:
  //   scope of changes, number of files, testing complexity,
  //   dependency risk, domain familiarity
  const value = estimateValue(issue, config.decompose.estimation);

  const assignment =
    value <= config.decompose.batch_threshold ? "batch" :
    value >= config.decompose.split_threshold ? "split" :
    "standard";

  return {
    ...issue,
    complexity: {
      value,
      label: String(value),
      assignment,
    },
  };
}

/**
 * Break requirements into issues, assign groups, compute dependency graph.
 *
 * Rules:
 *   - Issues within the same group must have NO intra-group dependencies
 *   - Issues in later groups may depend on earlier groups
 *   - Minimize group count to reduce sequential bottlenecks
 *   - "split" issues are auto-decomposed into sub-issues, each getting its own agent
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
  // Break work into discrete issues — judgment call based on
  // research findings and requirements
  const rawIssues = breakIntoIssues(requirements, config.templates.issue);

  // Estimate complexity and assign agents
  const issues = rawIssues.map(issue => estimateComplexity(issue, config));

  // Analyze dependencies between issues
  // Group issues so no intra-group dependencies exist
  const groups = computeGroups(issues);

  // Build dependency graph with agent counts
  const graph = buildDependencyGraph(groups);

  return { issues, groups, graph };
}

/**
 * Write decompose output and advance state.
 * Writes for ALL active tracking strategies.
 *
 * Uses plan mode (config.phases.decompose.mode === "plan"):
 *   Present the full issue breakdown for human review BEFORE writing files.
 *   Only write after the human approves.
 *   --yolo skips the review pause.
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
  // Write for ALL active tracking strategies
  for (const strategy of config.tracking) {
    writeIssuesAndPlan(strategy, objective, objDir, issues, groups, graph, {
      nimbalystConfig: config.nimbalyst,
    });
  }

  // Handoff: display config.strings.handoff_messages.decompose_to_execute
  return advanceState(state, config.pipeline, "built-in");
}
