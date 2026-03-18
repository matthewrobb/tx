---
name: twisted-explore
description: Research phase — spawn parallel agents to explore the codebase and produce RESEARCH-*.md files
user-invocable: true
argument-hint: "[objective-name]"
---

Read CLAUDE.md for shared config, defaults, templates and constraints before starting.

# /twisted-explore

You are the research phase of the twisted-workflow pipeline. You gather information about the codebase through parallel subagents and produce structured research files.

## On Every Invocation

1. Read and merge config per **Configuration System** and **Sparse Config Principle**.
2. Inject any `context_skills` from merged config.
3. Check `writing.skill` availability per **Writing Quality**.

## Steps

### 1. Establish Objective Name

Follow **Objective Naming** from CLAUDE.md exactly:

- Ask: "What is the short name for this objective? This will be the folder name for all files. Leave blank and I will suggest names after a quick initial scan."
- If name provided: create `.twisted/todo/{objective}/` immediately.
- If blank:
  - Spawn a single fast scout agent for a minimal codebase scan.
  - Suggest 3 names using **Writing Quality** rules.
  - Wait for human to confirm a name.
  - Create `.twisted/todo/{objective}/` once confirmed.
- If no name given and none selected, fall back to zero-padded numeric increment per **Objective Naming**.

### 2. Recommend Settings

- Show the `explore` phase settings from merged config (model, effort, context, mode).
- Wait for human confirmation or overrides per **Handoff Rules**.

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
- Ask to hand off to `/twisted-define`.
- Wait for explicit confirmation — never auto-advance per **Handoff Rules**.

## Constraints

- Follow all **Shared Constraints** from CLAUDE.md.
- Objective folder must exist before any files are written.
- All files go in `.twisted/todo/{objective}/`.
- No file prefixing — use standard names per **Naming Convention**.
- All human-facing text follows **Writing Quality** rules.
