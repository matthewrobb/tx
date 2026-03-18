---
name: twisted-build
description: Build phase — execute the plan group by group using parallel worktree subagents, with review between groups
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

Read CLAUDE.md for shared config, defaults, templates and constraints before starting.

# /twisted-build

You are the build phase of the twisted-workflow pipeline. You execute the plan by spawning parallel subagents in isolated worktrees, one per issue, group by group.

## On Every Invocation

1. Read and merge config per **Configuration System** and **Sparse Config Principle**.
2. Inject any `context_skills` from merged config.
3. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Find Objective Folder

- Find the objective folder in `todo/` or `in-progress/` (if resuming).
- If entering the pipeline after earlier phases and no folder exists, follow **Handoff Rules**: ask for objective name and create folder before reading or writing any files.

### 2. Recommend Settings

- Show the `build` phase settings from merged config (model, effort, context, mode).
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Read Plan

- Read `ISSUES.md` and `PLAN.md` from the objective folder.
- Identify the first incomplete group (group with unchecked issues).

### 4. Move to In-Progress

- If the objective folder is still in `todo/`, move it now:
  `.twisted/todo/{objective}/` to `.twisted/in-progress/{objective}/`.
- Commit the lane move using **Writing Quality** rules.
- This follows **Kanban Transitions** — always commit after a lane move.
- Skip this step if already in `in-progress/` (resuming a previous build).

### 5. Create Objective Worktree

- Create the objective worktree and branch from main:
  ```
  git worktree add .twisted/worktrees/{objective} -b {objective}
  ```
- Skip this step if the objective worktree already exists (resuming a previous build).
- All issue work happens on branches off this objective branch, not main.

### 6. Execute Group

For each group, starting with the first incomplete:

#### a. Create Group Worktree

- Create a group worktree branched from the **objective branch**:
  ```
  git worktree add .twisted/worktrees/{objective}-group-N -b {objective}/group-N {objective}
  ```

#### b. Create Issue Worktrees

- Create one worktree per issue, branched from the **group branch**:
  ```
  git worktree add .twisted/worktrees/{objective}-issue-XXX -b {objective}/issue-XXX {objective}/group-N
  ```

#### c. Spawn Parallel Subagents

- Spawn one subagent per issue worktree simultaneously.
- Each subagent must:
  - Work only in its assigned worktree.
  - Implement the issue fully.
  - Write or update tests.
  - Pass all tests before reporting back.
  - Mark `[x] Done` in ISSUES.md inside the worktree.
  - Commit implementation only — not ISSUES.md separately.
  - Report back with a summary.

#### d. Review and Merge into Group

When all subagents in the group report back:

1. Run **spec compliance review** per issue worktree — spec before code quality per **Shared Constraints**.
2. Run **code quality review** per issue worktree.
3. Merge passing issue worktrees into the **group branch** (normal merge).
4. ISSUES.md updates come in via merge — do NOT update ISSUES.md again after merging.
5. Clean up issue worktrees from `.twisted/worktrees/`.

#### e. Squash Merge Group into Objective

- Squash merge the group branch into the **objective branch** — one commit per group.
- Clean up the group worktree from `.twisted/worktrees/`.

#### f. Cross-Group Review

- Run `/requesting-code-review` on the merged work in the objective worktree per **Shared Constraints**.
- Never skip this step between groups.

#### g. Continue or Stop

- If `--yolo`: continue to next group automatically.
- Otherwise: ask the human to continue to next group or stop here, wait for explicit confirmation per **Handoff Rules**.
- If stop (non-yolo only): the objective stays in `in-progress/` at the current group.

### 7. Handoff

- When all groups are complete, summarize using **Writing Quality** rules.
- If `--yolo`: auto-advance to `/twisted-review --yolo` immediately.
- Otherwise: ask to hand off to `/twisted-review`, wait for explicit confirmation per **Handoff Rules**.

## Constraints

- Follow all **Shared Constraints** from CLAUDE.md.
- Worktree hierarchy: objective → group → issue per **Shared Constraints**.
- Issue worktrees merge (normal) into group, group squash merges into objective.
- Tests must pass before a subagent reports back.
- Spec compliance review always before code quality review.
- Never skip `/requesting-code-review` between groups.
- No file prefixing — use standard names per **Naming Convention**.
- All human-facing text follows **Writing Quality** rules.
- Never move the folder backward through lanes per **Kanban Transitions**.
