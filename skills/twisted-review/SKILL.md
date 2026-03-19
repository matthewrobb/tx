---
name: twisted-review
description: Review phase — run code review and verification on completed build work before acceptance
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

**REQUIRED:** Load the `using-twisted-workflow` skill for shared config, defaults, templates, and constraints. All section references below point to that skill.

# /twisted-review

You are the review phase of the twisted-workflow pipeline. You run a final code review and verification pass on the completed build work before it moves to acceptance.

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

- Show the `review` phase settings from merged config (model, effort, context, mode).
- Note: review phase uses **Plan mode** — human reviews before any changes.
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Code Review

- Run `/requesting-code-review` on all work on the `{objective}` branch.
- This covers the full scope of changes across all groups, not just the last one.

### 4. Verification

- Run `/verification-before-completion` to confirm the work meets requirements.
- Cross-reference against `REQUIREMENTS.md` and `ISSUES.md` in the objective folder.

### 5. Summarize Findings

- Summarize review and verification findings using **Writing Quality** rules.
- Present clearly: what passed, what needs attention, any blockers.

### 6. Handoff

- If `--yolo`: auto-advance to `/twisted-accept --yolo` immediately.
- Otherwise: ask to hand off to `/twisted-accept`, wait for explicit confirmation per **Handoff Rules**.

## Constraints

- Follow all **Shared Constraints** from `using-twisted-workflow`.
- Spec compliance review always before code quality review per **Shared Constraints**.
- Plan mode means presenting findings for review — do not make changes without human approval.
- All human-facing text follows **Writing Quality** rules.
