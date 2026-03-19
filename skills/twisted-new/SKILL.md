---
name: twisted-new
description: Research phase — spawn parallel agents to explore the codebase and produce RESEARCH-*.md files
user-invocable: true
argument-hint: "[objective-name] [--yolo]"
---

**REQUIRED:** Load the `using-twisted-workflow` skill for shared config, defaults, templates, and constraints. All section references below point to that skill.

# /twisted-new

You are the research phase of the twisted-workflow pipeline. You gather information about the codebase through parallel subagents and produce structured research files.

## On Every Invocation

1. Load `using-twisted-workflow` if not already loaded.
2. Read and merge config per **Configuration System** and **Sparse Config Principle**.
3. Inject any `context_skills` from merged config.
4. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Establish Objective Name

Follow **Objective Naming** from `using-twisted-workflow` exactly:

- Ask: "What is the short name for this objective? This will be the folder name for all files. Leave blank and I will suggest names after a quick initial scan."
- If name provided: create `.twisted/todo/{objective}/` immediately.
- If blank:
  - Spawn a single fast scout agent for a minimal codebase scan.
  - Suggest 3 names using **Writing Quality** rules.
  - Wait for human to confirm a name.
  - Create `.twisted/todo/{objective}/` once confirmed.
- If no name given and none selected, fall back to zero-padded numeric increment per **Objective Naming**.

### 2. Recommend Settings

- Show the `new` phase settings from merged config (model, effort, context, mode).
- If `--yolo`: use merged config values directly, skip confirmation.
- Otherwise: wait for human confirmation or overrides per **Handoff Rules**.

### 3. Spawn Parallel Research Agents

- Determine research areas based on the objective and codebase.
- Spawn parallel subagents, each focused on a distinct area.
- Each agent explores its area and returns structured findings.

### 4. Write Research Files

- Write findings to the objective folder using the `research_section` template from **Built-in Defaults**.
- Format each agent's output as a section: `## Agent {n} — {focus}`.
- If findings are large, split across multiple files: `RESEARCH-1.md`, `RESEARCH-2.md`, etc.
- Split by agent group, not arbitrarily.

### 5. Handoff

- Summarize all findings using **Writing Quality** rules.
- If `--yolo`: auto-advance to `/twisted-define --yolo` immediately.
- Otherwise: ask to hand off to `/twisted-define`, wait for explicit confirmation per **Handoff Rules**.

## Constraints

- Follow all **Shared Constraints** from `using-twisted-workflow`.
- Objective folder must exist before any files are written.
- All files go in `.twisted/todo/{objective}/`.
- No file prefixing — use standard names per **Naming Convention**.
- All human-facing text follows **Writing Quality** rules.
