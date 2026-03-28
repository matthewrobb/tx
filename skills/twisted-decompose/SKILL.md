---
name: twisted-decompose
description: Internal sub-skill — complexity estimation, issue breakdown, dependency analysis, and execution planning
---

**Read first:** These source files contain shared functions referenced below:
- `src/pipeline/dispatch.ts`
- `src/state/machine.ts`
- `src/strategies/writer.ts`

# twisted-decompose

Internal sub-skill loaded by `/twisted-work`. Handles **arch_review** and **decompose** steps.

---

## Arch Review Step

```typescript
/**
 * Execute the arch_review step.
 * No built-in implementation — always delegated or skipped.
 * Uses dispatchPhase — see using-twisted-workflow for details.
 */
export function executeArchReview(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { newState } = dispatchPhase("arch_review", config, state);
  return newState;
}
```
---

## Decompose Step

```typescript
/**
 * Read research + requirements from the primary tracking strategy's location.
 */
export function readInputsForDecompose(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): { research: string | null; requirements: string | null } {
  const primaryStrategy = config.tracking[0] ?? "twisted";

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
```
```typescript
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
```
```typescript
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
```
```typescript
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
  forEachStrategy(config, (strategy) => {
    writeIssuesAndPlan(strategy, objective, objDir, issues, groups, graph, {
      nimbalystConfig: config.nimbalyst,
    });
  });

  // Handoff: display config.strings.handoff_messages.decompose_to_execute
  return advanceState(state, config.pipeline, "built-in");
}
```

