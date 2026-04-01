# cli-tool — Scope

## Objective

Replace embedded skill logic with a real CLI tool (`tx`) that owns all
deterministic operations and all objective file I/O. Skills become thin
wrappers. Agents interact exclusively through `tx` commands.

## Requirements

### CLI Binary
- Entry point: `tx` via npm bin
- Two output modes: human (pretty) and `-a` (structured JSON)
- Every `-a` command returns `AgentResponse` contract
- Companion mode for humans — handoff prompts for judgment steps
- Node/TypeScript, Bun for development
- Distributed as npm package (`npx twisted-workflow`)

### Pipeline
- 5 steps: research, scope, plan, build, close
- `arch_review` becomes hook within plan
- `code_review` becomes hook within build
- `qa` and `ship` become sub-operations of close

### State
- `state.json` replaces YAML frontmatter in state.md
- Folder-based kanban retained (todo/in-progress/done)

### Sessions
- `tx pickup [name]` / `tx handoff [name]`
- `active.json` during session, LLM-written markdown on close
- Auto-start on `tx next -a`, crash recovery on resume
- `tx session save [name]` for agent to pipe summary
- `tx session status [name]` and `tx session list`

### Artifacts
- CLI owns all artifact paths — agents pipe to `tx write`, read via `tx read`
- No direct filesystem access to `.twisted/` by agents
- `tx write <type> [objective]` reads from stdin
- `tx read <type> [objective]` writes to stdout
- `tx artifacts [objective]` lists what exists

### Tasks
- `tasks.json` replaces issues.md — structured JSON
- `tx tasks [objective]` — list, add, update, assign, show
- Group assignment for parallel execution

### Notes
- `notes.json` — running log of all decisions, deferrals, discoveries, blockers
- `tx note <summary>` — default note type
- Type flags: `--decide`, `--defer`, `--discover`, `--blocker`
- `tx notes [objective] [--type] [--step]` — query

### Build System
- Keeps TS compiler API extraction + schema generation
- Extracts command signatures + JSDoc (not function bodies)
- Generates thin wrapper skills
- Adds CLI compilation step

### Distribution
- Version 3.0.0 (breaking change)
- `bin.tx` in package.json
- Plugin checks for CLI, suggests install if missing

### Removed Integrations
- gstack integration removed — not delivering value in practice
- nimbalyst integration removed — not delivering value in practice
- Provider strings simplified to: built-in, skip, ask, superpowers:<skill>

## Decisions Made

1. Big bang migration — codebase is small and well-tested
2. Bun for dev, npm for distribution — existing tests + broad compatibility
3. CLI owns all logic and all objective file I/O
4. Companion mode — no interactive TUI for judgment steps
5. `tx` as binary name — short, no conflicts
6. Pickup/handoff session lifecycle with LLM-written summaries
7. Notes system captures decisions/deferrals/discoveries across pipeline
8. Build system refactored (option 3) — AST extraction targets CLI signatures
9. Regular JSON for data files (not NDJSON)
10. Remove gstack and nimbalyst integrations

## Constraints

- Must support `npx twisted-workflow` without global install
- Skills must degrade gracefully if CLI not installed
- Existing 223 tests need updating for new pipeline shape
