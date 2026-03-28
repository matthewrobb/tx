import type { SkillDefinition } from "../../lib/skill.js";

export const twistedExecute: SkillDefinition = {
  frontmatter: {
    name: "twisted-execute",
    description:
      "Internal sub-skill — parallel execution with worktrees, delegated review/qa/ship, and state tracking",
  },
  content: `\
**REQUIRED:** Load the \`using-twisted-workflow\` skill for shared config, defaults, presets, string templates, and constraints. All section references below point to that skill.

# twisted-execute

You are the execute sub-skill, loaded by \`/twisted-work\`. You handle the **execute** pipeline step and coordinate delegation to **code_review**, **qa**, and **ship** steps. You are not user-invocable — \`/twisted-work\` loads you when needed.

## On Every Invocation

1. Receive the resolved config and objective state from \`/twisted-work\`.
2. Read \`ISSUES.md\` and \`PLAN.md\` from the objective folder.
3. Determine the current execution state from \`state.md\` frontmatter (\`group_current\`, \`issues_done\`).
4. Resume execution from the current group if partially complete.

---

## Execute Step

### 1. Move to In-Progress

If the objective status is \`todo\`:
- Update \`state.md\` status to \`in-progress\`.
- If \`state.use_folders\` is true: move the objective folder from the \`todo\` lane to the \`in-progress\` lane.
- Commit using \`strings.commit_messages.lane_move\`.

Skip this if the objective is already \`in-progress\` (resuming).

### 2. Create Objective Worktree

Create the objective worktree branched from main:
\`\`\`
git worktree add {directories.worktrees}/{objective} -b {objective}
\`\`\`

Skip if the worktree already exists (resuming).

### 3. Execute Groups

Read the execution order from \`PLAN.md\`. For each execution step in the order (respecting dependencies):

#### a. Determine Runnable Groups

From the execution order, identify which groups can run in this step. If \`execution.group_parallel\` is true, multiple independent groups run concurrently. Otherwise, run one group at a time.

#### b. For Each Group

##### Create Worktrees

Based on \`execution.worktree_tiers\`:

**2 tiers** (default): Create one worktree per agent, branched from the objective:
\`\`\`
git worktree add {directories.worktrees}/{objective}-agent-N -b {objective}/agent-N {objective}
\`\`\`

**3 tiers**: Create a group worktree from objective, then agent worktrees from group:
\`\`\`
git worktree add {directories.worktrees}/{objective}-group-G -b {objective}/group-G {objective}
git worktree add {directories.worktrees}/{objective}-group-G-agent-N -b {objective}/group-G/agent-N {objective}/group-G
\`\`\`

**1 tier**: No agent worktrees. Agents work on the objective branch directly (no isolation).

##### Determine Agent Assignments

From the issues in this group, determine agents based on complexity assignment:

| Assignment | Agent mapping |
|---|---|
| \`batch\` | All batched issues in the group → one agent |
| \`standard\` | One agent per issue |
| \`split\` | Sub-issues each get their own agent |

##### Spawn Agents

Based on \`execution.strategy\`:

**\`task-tool\`** (default): Spawn subagents via the Task/Agent tool. Use \`strings.execution_agent_prompt\`:

\`\`\`
Implement the following issues for objective "{objective}":

Issue IDs: {issue_ids}
{issue_details}

Work in worktree: {worktree_path}
Branch: {branch_name}
Test requirement: {test_requirement}
{discipline}

Commit your implementation. Mark issues as done. Report results.
\`\`\`

If \`execution.discipline\` is set (e.g., \`"superpowers:test-driven-development"\`), include it in the agent prompt as \`{discipline}\`.

Each agent must:
- Work only in its assigned worktree (if tiers > 1).
- Implement the assigned issue(s) fully.
- Write or update tests per \`execution.test_requirement\`:
  - \`must-pass\`: tests must pass before reporting completion.
  - \`best-effort\`: run tests, report results, failure does not block.
  - \`deferred\`: tests are not required.
- Commit the implementation.
- Report back with a summary, test results, and completion status.

**\`agent-teams\`**: Spawn teammates via Agent Teams. Same prompt and requirements.

**\`manual\`**: Print assignments with recommended model/effort configs. Wait for user to execute manually and report completion.

##### Wait for Completion

Wait for all agents in the group to report back. As agents complete:
- Update \`issues_done\` in \`state.md\`.
- Mark issues as done in \`ISSUES.md\`.
- Log the agent result in the execution log.

##### Merge Agent Work

Based on \`execution.worktree_tiers\` and \`execution.merge_strategy\`:

**2 tiers**: Merge each agent worktree into the objective branch using the configured \`merge_strategy\` (normal, squash, or rebase). Clean up agent worktrees.

**3 tiers**: Merge agent worktrees into the group branch, then merge the group branch into the objective branch. Clean up all worktrees for this group.

**1 tier**: No merging needed — work is already on the objective branch.

Commit group merge using \`strings.commit_messages.group_merge\`.

##### Per-Group Review

If \`execution.review_frequency\` is \`"per-group"\`:
- Delegate to \`pipeline.code_review.provider\` for this group's changes.
- If \`"risk-based"\`: review only if the group contains high-complexity issues (≥ \`decompose.split_threshold\`).

#### c. Update State

Update \`state.md\`:
- Set \`group_current\` to the next group number.
- Update \`issues_done\` count.
- Update \`updated\` timestamp.

#### d. Continue or Stop

If \`--yolo\` or \`flow.auto_advance\` is true: continue to next group automatically.

Otherwise: ask the user to continue to the next group or stop here. If stop, the objective stays \`in-progress\` at the current group — any session can resume later.

### 4. Execution Complete

When all groups are done:
- Update \`state.md\`:
  - Add \`execute\` to \`steps_completed\`.
  - Set \`step\` to \`code_review\` (or next non-skipped step).
  - Remove \`execute\` from \`steps_remaining\`.
  - Set \`group_current\` to null.
  - Record \`tools_used.execute: "built-in"\`.
  - Update \`updated\` timestamp.
- Display \`strings.handoff_messages.execute_to_review\`.

### 5. Post-Execution Delegation

After execute completes, \`/twisted-work\` handles delegation to the remaining steps. However, if auto-advance continues through this sub-skill:

#### Code Review

Delegate to \`pipeline.code_review.provider\`:
- If \`execution.review_frequency\` is \`"after-all"\`: review all changes on the objective branch.
- If reviews already ran per-group, this is a final holistic review.
- Update \`state.md\` and \`tools_used.code_review\`.
- Display \`strings.handoff_messages.review_to_ship\`.

#### QA

Delegate to \`pipeline.qa.provider\`:
- If \`"skip"\`: mark complete, advance.
- If external provider: delegate, update state.
- Update \`state.md\` and \`tools_used.qa\`.

#### Ship

Delegate to \`pipeline.ship.provider\`:
- If \`"built-in"\`:
  - Generate changelog entry using \`strings.changelog_entry\` template.
  - Write changelog per **Changelog** rules.
  - Merge the objective branch into main.
  - Clean up the objective worktree.
  - Delete the objective branch.
  - Move objective folder to done lane (if folders enabled).
  - Commit using \`strings.commit_messages.done\`.
- If external provider: delegate.
- Update \`state.md\`:
  - Set \`status\` to \`done\`.
  - Add \`ship\` to \`steps_completed\`.
  - Set \`steps_remaining\` to empty.
  - Record \`tools_used.ship\`.
- Display \`strings.handoff_messages.ship_done\`.

---

## Constraints

- Follow all **Shared Constraints** from \`using-twisted-workflow\`.
- Worktree hierarchy follows \`execution.worktree_tiers\` per **Worktree Hierarchy**.
- Agent merge uses \`execution.merge_strategy\`.
- Tests follow \`execution.test_requirement\`.
- Review follows \`execution.review_frequency\`.
- All human-facing text uses string templates from the resolved config.
- State transitions are atomic — update all frontmatter fields at once.
- Never move the objective folder backward through lanes.
- Always commit after lane moves and group merges.
- Clean up worktrees after merging — do not leave stale worktrees.`,
};
