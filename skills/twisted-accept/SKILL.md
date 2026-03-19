---
name: twisted-accept
description: Accept phase — generate changelog, move to done, commit, and close the development branch
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

**REQUIRED:** Load the `using-twisted-workflow` skill for shared config, defaults, templates, and constraints. All section references below point to that skill.

# /twisted-accept

You are the acceptance phase of the twisted-workflow pipeline. You generate the changelog entry, move the objective to done, commit everything, and close the branch.

## On Every Invocation

1. Load `using-twisted-workflow` if not already loaded.
2. Read and merge config per **Configuration System** and **Sparse Config Principle**.
3. Inject any `context_skills` from merged config.
4. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Find Objective Folder

- Find the objective folder in `in-progress/`.
- If entering the pipeline after earlier phases and no folder exists, follow **Handoff Rules**: ask for objective name and create folder before reading or writing any files.

### 2. Recommend Settings

- Show the `accept` phase settings from merged config (model, effort, context, mode).
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Generate Changelog Entry

- Read `ISSUES.md`, `PLAN.md`, and `REQUIREMENTS.md` from the objective folder.
- Generate a changelog entry using the `changelog_entry` template from **Built-in Defaults**:
  - What was built, changed, or fixed.
  - Issues resolved, organized by group.
  - Any deferred items and why.
  - Key decisions made during the work.
- Apply **Writing Quality** rules to all content.

### 4. Write Changelog

- Read the configured changelog path from `files.changelog` in merged config.
- If file exists at configured path: prepend the new entry — newest always at top.
- If file does not exist: create it at the configured path.
- Never hardcode the path — always use the config value per **Changelog** rules.

### 5. Merge Objective Branch

- Merge the `{objective}` branch into `main`.
- Clean up the objective worktree from `.twisted/worktrees/`.
- Delete the objective branch after merge.

### 6. Move to Done

- Move `.twisted/in-progress/{objective}/` to `.twisted/done/{objective}-[date]/`.
- Date format appended to folder name per **Kanban Transitions**.
- This follows **Kanban Transitions** — always commit after a lane move.

### 7. Commit

- Commit the lane move using `commit_messages.done` from merged config.
- Commit the changelog at the configured path.
- Apply **Writing Quality** rules to all commit messages.

### 8. Close Branch

- Run `/finishing-a-development-branch`.

### 9. Final Summary

- Summarize everything using **Writing Quality** rules:
  - What was completed.
  - Where the changelog entry lives.
  - Branch status.
- End with: "Work accepted and branch closed. All done."

## Constraints

- Follow all **Shared Constraints** from `using-twisted-workflow`.
- Changelog path always comes from config — never hardcode per **Changelog** rules.
- Never move the folder backward through lanes per **Kanban Transitions**.
- All human-facing text follows **Writing Quality** rules.
