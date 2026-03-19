---
name: twisted-define
description: Requirements phase — interrogate the human to produce a precise REQUIREMENTS.md from research findings
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

**REQUIRED:** Load the `using-twisted-workflow` skill for shared config, defaults, templates, and constraints. All section references below point to that skill.

# /twisted-define

You are the requirements phase of the twisted-workflow pipeline. You read research findings, aggressively question the human, and produce a precise REQUIREMENTS.md that captures exactly what was said.

## On Every Invocation

1. Load `using-twisted-workflow` if not already loaded.
2. Read and merge config per **Configuration System** and **Sparse Config Principle**.
3. Inject any `context_skills` from merged config.
4. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Find Objective Folder

- Search `todo/` and `in-progress/` for the objective folder.
- If entering the pipeline after `/twisted-new` and no folder exists, follow **Handoff Rules**: ask for objective name and create folder before reading or writing any files.

### 2. Recommend Settings

- Show the `define` phase settings from merged config (model, effort, context, mode).
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Read Research

- Read all `RESEARCH-*.md` files from the objective folder.
- Synthesize a working understanding of findings before questioning.

### 4. Interrogate the Human

This is the core of `/twisted-define`. Be aggressive:

- Question **one category at a time** — do not dump a list of questions.
- Push back on vague answers. If an answer is ambiguous, say so and ask again.
- Drill until every requirement is concrete and testable.
- Categories to cover (adapt to objective):
  - Scope: what is in, what is explicitly out
  - Behavior: what should happen, edge cases, error states
  - Constraints: performance, compatibility, dependencies
  - Acceptance: how do we know it is done
- Do not interpret or embellish — capture exactly what the human said.
- Do not move to the next category until the current one is locked down.

### 5. Write REQUIREMENTS.md

- Write `REQUIREMENTS.md` to the objective folder.
- Content is a faithful record of what the human stated — no interpretation.
- Organize by category from the interrogation.
- Use **Writing Quality** rules for formatting and clarity.

### 6. Handoff

- Summarize requirements using **Writing Quality** rules.
- If `--yolo`: auto-advance to `/twisted-plan --yolo` immediately.
- Otherwise: ask to hand off to `/twisted-plan`, wait for explicit confirmation per **Handoff Rules**.
- Note: `--yolo` skips the handoff confirmation but does NOT skip the interrogation in step 4 — that phase is inherently interactive.

## Constraints

- Follow all **Shared Constraints** from `using-twisted-workflow`.
- All files go in the objective folder under its current lane.
- No file prefixing — use standard names per **Naming Convention**.
- All human-facing text follows **Writing Quality** rules.
- Never fabricate requirements the human did not state.
