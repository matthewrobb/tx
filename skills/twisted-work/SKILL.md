---
name: twisted-work
description: Orchestrator for the twisted-workflow pipeline — init, status, next, resume, and interactive mode
user-invocable: true
argument-hint: "[init | status | next [objective] | resume {objective}] [--yolo]"
---

Read CLAUDE.md for shared config, defaults, templates and constraints before starting.

# /twisted-work

You are the orchestrator for the twisted-workflow pipeline. You route to the correct phase skill based on arguments and objective state.

## On Every Invocation

1. Read and merge config per **Configuration System** and **Sparse Config Principle**.
2. Inject any `context_skills` from merged config.
3. Check `writing.skill` availability per **Writing Quality**.

## Argument Routing

Parse the first argument and route:

| Argument | Action |
|---|---|
| `init` | Run **Init Flow** below |
| `status` | Run **Status Flow** below |
| `next` | Run **Next Flow** below |
| `next {objective}` | Run **Next Flow** for named objective |
| `resume {objective}` | Run **Resume Flow** below |
| *(none)* | Run **Interactive Flow** below |

---

## Init Flow

Follow `/twisted-work init steps` from CLAUDE.md exactly:

1. Ensure `.twisted/` directory structure exists per **Directory Structure**.
2. Apply **Gitignore Rules**.
3. If `settings.json` exists:
   - Load and merge with **Built-in Defaults**.
   - Show merged result with each value labelled `(custom)`, `(default)`, or `(new default)`.
   - Ask if human wants to update anything.
   - Write back only customised keys — never a full snapshot.
4. If `settings.json` does not exist:
   - Ask each setup question from the spec, one at a time.
   - Show the final merged result.
   - Write only customised keys to `settings.json`.
   - Commit using `commit_messages.init`.

---

## Status Flow

Follow `/twisted-work status steps` from CLAUDE.md:

1. Scan all lanes (`todo/`, `in-progress/`, `done/`).
2. For each objective, determine current phase using **Phase Detection** table.
3. Display the status table format from the spec, including changelog path.
4. Exit — do not invoke any skill.

---

## Next Flow

Follow `/twisted-work next / resume` from CLAUDE.md:

1. If no objective named: find the most recently modified objective across `todo/` and `in-progress/`.
2. Determine current phase using **Phase Detection**.
3. Advance to the **next** phase (not current).
4. If `--yolo` not active: recommend settings for that phase from merged config, wait for confirmation per **Handoff Rules**.
5. Invoke the corresponding `/twisted-{phase}` skill, passing `--yolo` through if active.

---

## Resume Flow

1. Find the named objective across all lanes.
2. Determine **current** phase using **Phase Detection**.
3. If `--yolo` not active: recommend settings for current phase, wait for confirmation per **Handoff Rules**.
4. Invoke the corresponding `/twisted-{phase}` skill at the current phase (not next), passing `--yolo` through if active.

---

## Interactive Flow

Follow `/twisted-work interactive steps` from CLAUDE.md:

1. Scan all lanes for existing objectives.
2. Show status table using **Writing Quality** rules.
3. Ask: resume an existing objective, or start new?
4. If resume: run **Resume Flow** for chosen objective.
5. If new: show the full pipeline, ask where to start.
6. Invoke the chosen `/twisted-{phase}` skill.

---

## Constraints

- Follow all **Shared Constraints** from CLAUDE.md.
- Follow all **Handoff Rules** and **Yolo Mode** — when `--yolo` is passed, skip confirmations and pass the flag through to invoked skills.
- All human-facing text follows **Writing Quality** rules.
- If no `.twisted/settings.json` found, note: "No .twisted/settings.json found, using defaults. Run /twisted-work init to configure."
