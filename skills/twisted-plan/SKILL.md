---
name: twisted-plan
description: Planning phase — produce ISSUES.md and PLAN.md with dependency-ordered parallel groups from research and requirements
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

Read CLAUDE.md for shared config, defaults, templates and constraints before starting.

# /twisted-plan

You are the planning phase of the twisted-workflow pipeline. You read research and requirements, then produce a structured ISSUES.md and a dependency-ordered PLAN.md with parallel groups.

## On Every Invocation

1. Read and merge config per **Configuration System** and **Sparse Config Principle**.
2. Inject any `context_skills` from merged config.
3. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Find Objective Folder

- Find the objective folder in `todo/`.
- If entering the pipeline after earlier phases and no folder exists, follow **Handoff Rules**: ask for objective name and create folder before reading or writing any files.

### 2. Recommend Settings

- Show the `plan` phase settings from merged config (model, effort, context, mode).
- Note: plan phase uses **Plan mode** — human reviews before files change.
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Read Inputs

- Read all `RESEARCH-*.md` and `REQUIREMENTS.md` from the objective folder.
- Build a complete picture of scope, constraints, and acceptance criteria.

### 4. Write ISSUES.md

- Break the work into discrete issues using the `issue` template from **Built-in Defaults**.
- Each issue must have:
  - A unique ID: `ISSUE-{id}`
  - Type, area, file, current state, target state
  - Dependencies on other issues
  - Group assignment (issues in the same group can be worked in parallel)
  - A `[ ] Done` checkbox
- Issues within a group must have no dependencies on each other.
- Issues in later groups may depend on earlier groups.

### 5. Write PLAN.md

- Organize issues into dependency-ordered parallel groups.
- Each group must be completable in one session.
- Document the execution order: Group 1 first, then Group 2, etc.
- For each group, list which issues run in parallel and any notes on worktree setup.
- Reference issue IDs — do not duplicate issue content.

### 6. Commit

- Commit both files using `commit_messages.plan` from merged config.
- Apply **Writing Quality** rules to the commit message.

### 7. Handoff

- Summarize the plan using **Writing Quality** rules: number of issues, number of groups, key dependencies.
- If `--yolo`: auto-advance to `/twisted-build --yolo` immediately.
- Otherwise: ask to hand off to `/twisted-build`, wait for explicit confirmation per **Handoff Rules**.

## Constraints

- Follow all **Shared Constraints** from CLAUDE.md.
- All files go in the objective folder under `todo/`.
- No file prefixing — use standard names per **Naming Convention**.
- All human-facing text follows **Writing Quality** rules.
- Plan mode means presenting the plan for review — do not write files until human approves.
