# Session 001 — research, scope, plan

- **Steps:** research → scope → decompose
- **Started:** 2026-03-31
- **Ended:** 2026-03-31

## Summary

Designed and planned the v3 CLI tool (`tx`) that replaces embedded skill logic. Went from initial idea through brainstorming, design spec, scope, and full implementation plan with 16 tasks across 4 execution groups.

## Context Files

- `.twisted/todo/cli-tool/RESEARCH-1.md` — design spec
- `.twisted/todo/cli-tool/REQUIREMENTS.md` — scope/requirements
- `.twisted/todo/cli-tool/PLAN.md` — 16-task implementation plan
- `.twisted/todo/cli-tool/ISSUES.md` — issue breakdown with groups
- `docs/superpowers/specs/2026-03-31-cli-tool-design.md` — canonical spec
- `docs/superpowers/plans/2026-03-31-cli-tool.md` — canonical plan

## Decisions

1. **Big bang migration** — codebase is small (~111KB src/, 223 tests), well-structured
2. **Bun for dev, npm for distribution** — existing tests use Bun, need broad compatibility via `npx twisted-workflow`
3. **CLI owns all logic AND all file I/O** — agents never read/write `.twisted/` directly, everything through `tx` commands
4. **Companion mode** — humans use CLI for control, delegate judgment steps to Claude. No interactive TUI
5. **`tx` as binary name** — short, no conflicts with existing tools
6. **Pickup/handoff session lifecycle** — `tx pickup [name]` / `tx handoff [name]`, structured JSON while open, LLM-written markdown on close
7. **Notes system replaces decisions log** — `tx note` with type flags (`--decide`, `--defer`, `--discover`, `--blocker`), default is plain note
8. **Build system option 3** — AST extraction targets CLI signatures + JSDoc, not function bodies. Generates thin wrapper skills
9. **Regular JSON for data files** — not NDJSON, CLI owns all reads/writes so no append-only benefit
10. **Remove gstack and nimbalyst integrations** — not delivering value, simplifies provider strings to built-in/skip/ask/superpowers
11. **5-step pipeline** — `research → scope → plan → build → close` (was 8 steps)
12. **`open`/`close` for objectives, `start`/`end` for sessions** — `tx open <name>` creates, `tx close` is final pipeline step
13. **Tasks in JSON, plan stays markdown** — `tasks.json` replaces `issues.md` for structured data, `plan.md` stays for narrative prose
14. **Artifact placement owned by CLI** — agents pipe to `tx write`, read via `tx read`, no direct filesystem access
15. **State in JSON** — `state.json` replaces YAML frontmatter in `state.md`
16. **Short flags** — `-a` for `--agent`, `-y` for `--yolo`, `-o` for `--objective`

## Deferrals

1. **Interactive TUI for human-driven scoping** — massive scope increase, companion mode sufficient for v1
2. **v2 → v3 migration tooling** — no task covers migrating existing `.twisted/` data from frontmatter to JSON format
3. **Config editing via CLI** — `tx config` shows config but doesn't implement interactive editing

## Discoveries

1. **`build/lib/extract.ts` assumes function-level exports** — will need refactoring when CLI adds class-based commands
2. **Provider routing not fully implemented** — plan doesn't specify how `superpowers:*` providers are actually invoked/validated at runtime

## Next

Execute step. 16 tasks in 4 groups:
- **Group 1** (foundation): types, state machine, config — do first
- **Group 2** (new systems): notes, tasks, sessions, artifacts — parallelizable
- **Group 3** (CLI): arg parser, formatters, entry point, test updates — depends on 1+2
- **Group 4** (build/dist): build system, tsc, integration tests, docs — depends on 3

Recommend subagent-driven execution per the plan header.
