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
