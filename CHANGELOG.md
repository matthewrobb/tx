## [4.0.0] - 2026-04-01

### Breaking Changes
- Runtime switched from **Bun to Node.js + npm**. Run `npm install` instead of `bun install`. Tests now use `vitest` instead of `bun test`.
- Epic state stored in `state.json` now uses `CoreState` shape (`epic`, `type`, `lane`, `step`, `status`). v3 `ObjectiveState` is kept for backwards compatibility during migration.
- Config version `"4.0"` introduced. v3 `TwistedConfig` (`version: "3.0"`) is still supported.
- Skill renamed from `twisted-work` → `tx`. Update any `/twisted-work` invocations to `/tx`.

### Added — Architecture
- **6-lane filesystem** (`0-backlog`, `1-ready`, `2-active`, `3-review`, `4-done`, `5-archive`). Epics move between lanes as they progress.
- **Artifact-driven engine** (`src/engine/`): steps declare `produces`/`requires`/`exit_when`; `tx next` evaluates conditions automatically. No more hardcoded step transitions.
- **XState v5 state machine** for epic lifecycle (`active` / `blocked` / `complete` / `error`) with snapshot persistence to `machine-snapshot.json`.
- **On-demand daemon** (`src/daemon/`) via `sock-daemon`. Socket stored in OS temp dir, keyed by project path hash.
- **`.claude/agents/` symlinks** — `tx init` creates a symlink per epic pointing to its current lane dir, giving agents direct access to epic context.

### Added — Commands
- `tx open <epic> --type <feature|bug|spike|chore|release>` — epic types drive lane sequences
- `tx ready <epic>` — move from `0-backlog` → `1-ready`
- `tx archive <epic> [--reason]` — move to `5-archive`
- `tx estimate <epic> --size <XS|S|M|L|XL> --rationale <text> [--timebox <P2D>] [--confidence 1-5]`
- `tx promote <epic> --type <type>` — convert a spike to another type, recompute lane sequence
- `tx stories <epic> [add <summary> | done <S-001> | show <S-001>]` — story CRUD
- `tx backlog [promote <BC-001>]` — list or promote retro backlog candidates
- `-e / --epic` flag as alias for `-o / --objective`

### Added — Pipeline Steps
- `decompose` step in `2-active` (after `plan`, before `build`) — produces `stories.json`
- `estimate` step in `1-ready` — produces `estimate.json`; `timebox` field for spikes

### Added — Close / Retro
- `tx close` now aggregates retro and deferral notes into `retro.md` + `backlog-candidates.json` in the epic's done lane directory

### Changed
- `npm run build` (was `bun run build`) — uses `tsx` to run the build script
- `npm test` (was `bun test`) — runs `vitest`
- `build/__tests__/` glob expanded to `build/**/*.test.ts` — now covers `build/lib/` and `build/schema/` tests too
- Skill argument-hint updated to include new v4 commands
- README fully rewritten for v4

### Removed
- Dead v3 source directories: `src/scope/`, `src/decompose/`, `src/execute/`, `src/pipeline/`, `src/strategies/`, `src/work/`
- Dead test files: `pipeline-routing.test.ts`, `strategies-worktree.test.ts`
- `bun.lock` — replaced by `package-lock.json`
- `@types/bun` dev dependency

## [3.0.1] - 2026-03-31

### Fixed
- `tx read` error message referenced undefined `path` variable (now uses `fullPath`)
- `tx handoff` no longer deletes `active.json` before `tx session save` can read it
- `updateTask` no longer clobbers existing fields with `undefined` when optional params omitted

### Added
- `--undone` flag for `tx tasks update` to unmark completed tasks
- `--note` flag for `tx note` (explicit default type, symmetric with `--decide` etc.)
- `tx session save <name>` now applies the name argument to the saved session filename
- `listObjectiveFiles` in `fs.ts` — centralizes `readdirSync` + Windows path normalization
- ArtifactType validation in `tx write` / `tx read` with helpful error on unknown type
- Session lifecycle integration tests (pickup, handoff→save, session list)

### Changed
- Removed `as any` casts throughout `index.ts` — proper `ArtifactType`, `NoteType`, `ObjectiveStep` types
- `tx close` uses `config.pipeline.qa` / `config.pipeline.ship` directly (no cast)
- `formatStatusDetail` now renders `config.strings.status_detail` template (configurable)
- `status_detail` default template updated to v3 field names (`tasks_done/total`, `steps_done/total`)
- `bin` path in `package.json` corrected to `./dist/cli/index.js`
- README fully rewritten for v3 (CLI commands, 5-step pipeline, v3 directory structure)

### Removed
- `using-twisted-workflow` skill (content covered by README and `twisted-work` skill)

## [3.0.0] - 2026-03-31

### Breaking Changes
- Pipeline simplified from 8 steps to 5: research → scope → plan → build → close
- Removed gstack and nimbalyst integrations
- State now stored as JSON (state.json) instead of YAML frontmatter (state.md)
- Tasks stored as tasks.json (replaces ISSUES.md)

### Added
- `tx` CLI binary — agents interact via CLI commands instead of embedded skills
- Notes system (`tx note`) with typed notes: decision, deferral, discovery, blocker
- Session lifecycle (`tx pickup` / `tx handoff`) with structured handoffs
- Artifact routing (`tx write` / `tx read`) — agents pipe content through CLI
- JSON output mode (`--agent` / `-a`) for all commands

### Removed
- gstack and nimbalyst presets
- Multi-tracking strategy support
- `src/strategies/writer.ts`, `src/state/status.ts` (nimbalyst mapping)
- Sub-skills: twisted-scope, twisted-decompose, twisted-execute (replaced by tx CLI)
