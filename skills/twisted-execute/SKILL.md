---
name: twisted-execute
description: Internal sub-skill — parallel execution with worktrees, delegated review/qa/ship, and state tracking
---

# twisted-execute

Internal sub-skill loaded by `/twisted-work`. Handles **execute**, **code_review**, **qa**, and **ship** steps.

---

## Execute Step

```typescript
/**
 * Read issues and plan from the primary tracking strategy.
 */
export function readIssuesForExecute(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): { issues: Issue[]; groups: IssueGroup[] } {
  const primaryStrategy = config.tracking[0] ?? "twisted";
  const paths = getArtifactPaths(primaryStrategy, objective, objDir);

  switch (primaryStrategy) {
    case "twisted":
    case "gstack":
      // Both use ISSUES.md in objDir (gstack always writes it for execute)
      return readIssuesFile(paths.issues!);
    case "nimbalyst":
      // Parse the plan doc's Implementation Progress checklist
      return readNimbalystChecklist(paths.plan);
    default:
      return readIssuesFile(`${objDir}/ISSUES.md`);
  }
}
```
```typescript
/**
 * Move objective to in-progress if still in todo.
 * Commits the lane move using config.strings.commit_messages.lane_move.
 */
export function moveToInProgress(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
): ObjectiveState {
  if (state.status === "todo") {
    // Update state atomically
    const newState: ObjectiveState = {
      ...state,
      status: "in-progress",
    };
    writeStateFrontmatter(newState);

    // Move folder if kanban folders enabled
    if (config.state.use_folders) {
      moveFolder(
        `${config.state.folder_kanban.todo}/${objective}`,
        `${config.state.folder_kanban.in_progress}/${objective}`,
      );
      commitLaneMove(config, objective, "todo", "in-progress");
    }

    return newState;
  }
  return state;
}
```
```typescript
/**
 * Execute groups in dependency order.
 *
 * For each execution batch (groups that can run concurrently):
 *   1. Create worktrees based on config.execution.worktree_tiers (1, 2, or 3)
 *   2. Determine agent assignments from complexity (batch/standard/split)
 *   3. Spawn agents using config.execution.strategy (task-tool, agent-teams, manual)
 *   4. Each agent: implement issues, run tests per config.execution.test_requirement:
 *        "must-pass"   — tests must pass before completion
 *        "best-effort" — run tests, report results, failure doesn't block
 *        "deferred"    — tests not required
 *   5. Merge agent work using config.execution.merge_strategy (normal, squash, rebase)
 *   6. If config.execution.review_frequency === "per-group": run code review
 *   7. Clean up agent worktrees
 *   8. Update state (issues_done, group_current)
 *   9. If not --yolo: ask "continue to next group or stop?"
 */
export function executeGroups(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  groups: IssueGroup[],
  graph: DependencyGraph,
  yolo: boolean,
): ObjectiveState {
  const executionOrder = computeExecutionOrder(groups);
  const worktreePaths = getWorktreePaths(
    config.directories.worktrees,
    objective,
    config.execution.worktree_tiers,
  );

  // Create objective worktree (branched from main)
  // Skip if already exists (resuming)
  createWorktreeIfNeeded(worktreePaths.objective, objective);

  let currentState = state;

  for (const batch of executionOrder) {
    // batch: number[] — group numbers that can run concurrently
    // If config.execution.group_parallel === false, run one at a time

    for (const groupNumber of batch) {
      const group = groups.find(g => g.number === groupNumber)!;

      // Create agent worktrees based on tier config
      const commands = getWorktreeCommands(
        config.directories.worktrees,
        objective,
        config.execution.worktree_tiers,
        groupNumber,
        countAgents(group),
      );
      executeGitCommands(commands);

      // Spawn agents: config.execution.strategy
      //   "task-tool"    → spawn via Task/Agent tool (default)
      //   "agent-teams"  → spawn via Agent Teams
      //   "manual"       → print assignments, user executes
      //   "auto"         → analyze and choose per group
      const results = spawnAgents(config, objective, group, worktreePaths);

      // Merge agent work: config.execution.merge_strategy
      //   "normal"  → standard merge, preserves history
      //   "squash"  → one commit per agent
      //   "rebase"  → linear history
      mergeAgentWork(config.execution.merge_strategy, worktreePaths);

      // Commit group merge
      commitGroupMerge(config, objective, groupNumber);

      // Review frequency: "per-group" | "risk-based" | "after-all"
      // after-all: skip per-group review, do one review after all groups
      if (config.execution.review_frequency === "per-group") {
        delegateCodeReview(config, objective, groupNumber);
      }
      // risk-based: review only if group contains high-complexity issues
      if (config.execution.review_frequency === "risk-based") {
        if (group.issues.some(i => i.complexity.value >= config.decompose.split_threshold)) {
          delegateCodeReview(config, objective, groupNumber);
        }
      }

      // Clean up agent worktrees
      cleanupWorktrees(worktreePaths, groupNumber);

      // Update state
      currentState = {
        ...currentState,
        group_current: groupNumber,
        issues_done: currentState.issues_done + group.issues.length,
        updated: new Date().toISOString(),
      };
      writeStateFrontmatter(currentState);

      // Update ALL tracking strategy artifacts
      for (const strategy of config.tracking) {
        updateTrackingProgress(strategy, objective, objDir, currentState);
      }
    }

    // Between batches: ask to continue or stop (unless --yolo)
    if (!yolo && !config.flow.auto_advance) {
      const shouldContinue = askUser("Continue to next group?");
      if (!shouldContinue) return currentState; // pause — resume later
    }
  }

  // All groups complete
  // Handoff: display config.strings.handoff_messages.execute_to_review
  return advanceState(currentState, config.pipeline, "built-in");
}
```
---

## Post-Execution Delegation

```typescript
/**
 * Delegate code review.
 * review_frequency determines when this runs:
 *   "after-all" → once after all groups (default)
 *   "per-group" → already ran per-group during execute
 *   "risk-based" → already ran for high-complexity groups
 */
export function executeCodeReview(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  // Handoff: display config.strings.handoff_messages.review_to_ship
  const { newState } = dispatchPhase("code_review", config, state);
  return newState;
}
```
```typescript
/**
 * Delegate QA.
 */
export function executeQA(
  config: TwistedConfig,
  state: ObjectiveState,
): ObjectiveState {
  const { newState } = dispatchPhase("qa", config, state);
  return newState;
}
```
```typescript
/**
 * Execute the ship step.
 *
 * Built-in:
 *   1. Generate changelog using config.strings.changelog_entry template
 *   2. Write to config.files.changelog (prepend if newest-first, append if oldest-first)
 *   3. Merge objective branch into main
 *   4. Clean up objective worktree
 *   5. Move objective folder to done lane (if folders enabled)
 *   6. Commit using config.strings.commit_messages.done
 *
 * Delegated: invoke provider (e.g. "gstack:/ship")
 */
export function executeShip(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
): ObjectiveState {
  const { action, newState } = dispatchPhase("ship", config, state);
  if (action !== "built-in") return newState;

  // Built-in ship
  generateChangelog(config, objective);
  mergeToMain(objective);
  cleanupObjectiveWorktree(config.directories.worktrees, objective);

  if (config.state.use_folders) {
    const date = new Date().toISOString().split("T")[0];
    moveFolder(
      `${config.state.folder_kanban.in_progress}/${objective}`,
      `${config.state.folder_kanban.done}/${objective}-${date}`,
    );
  }

  commitDone(config, objective);

  // Handoff: display config.strings.handoff_messages.ship_done
  return advanceState(state, config.pipeline, "built-in");
}
```

