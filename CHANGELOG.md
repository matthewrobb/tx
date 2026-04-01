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
