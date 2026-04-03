# Session #3 — v4 Data-Driven Engine: Full Implementation + Code Review

**Epic:** improve-codebase-architecture
**Branch:** feat/v4-data-driven-engine
**Started:** 2026-04-03T01:54:13Z
**Ended:** 2026-04-03T04:03:04Z
**Step at start:** build (2-active)

## Completed

### All 25 Stories Across 6 Waves

- **Wave 0**: S-001 (core types), S-002 (port interfaces)
- **Wave 1**: S-003 PGLite adapter, S-005 expression parser/evaluator, S-008 DAG resolver, S-016 checkpoints, S-019 socket transport, S-026 build system
- **Wave 2**: S-006 interactive expressions, S-007 config validation, S-009 XState machine generator, S-010 step evaluation, S-012 issue CRUD, S-022 markdown projection
- **Wave 3**: S-011 atomic txNext, S-013 deferrals, S-017 policy engine, S-023 npm resolver
- **Wave 4**: S-014 issue workflow, S-018 daemon server, S-024 guided init, S-025 workflow migration
- **Wave 5**: S-015 cycle lifecycle, S-020 CLI
- **Wave 6**: S-027 E2E tests

### Code Review + Cleanup
- Deleted 21 orphaned v3 source files (src/engine/, src/cli/, src/daemon/, src/stories/, src/agents/)
- Deleted 4 stale build tests importing deleted v3 files
- Updated build/lib/imports.ts and build/schema/settings.ts for v4
- Regenerated schemas/settings.schema.json

**Final state: 382 tests, 32 files, all green. Branch is clean at commit 109db7f.**

## Known Gaps — TDD Debt (Next Session Priority)

All agents wrote implementation + tests together (horizontal slicing). The mattpocock TDD skill (skills/mattpocock/tdd/SKILL.md) was never included in agent prompts. Tests were naturally shaped to avoid stubs, so three functional gaps passed undetected.

### Gap 1: Artifact context always empty (src/engine/state.ts:149)
`buildArtifactContext([], [])` hardcoded — `done_when: "artifacts.all_present"` always returns false.
- **Design question**: StepArtifact.path is e.g. "scope.md". handleWrite stores by type name ("scope"). Need to align the key convention before implementing.
- **Fix**: Write RED test → decide convention → implement query in buildContext.

### Gap 2: Cycle context always null (src/engine/state.ts:169)
`cycle: null` hardcoded — `done_when: "cycle.status == 'active'"` always gets null.
- **Fix**: Write RED test → add `SELECT * FROM cycles WHERE status = 'active' LIMIT 1` to buildContext → map to CycleContext.

### Gap 3: Cycle daemon handlers not wired (src/daemon/server.ts:108)
`cycle_start`, `cycle_pull`, `cycle_close` return "not yet implemented". src/cycles/lifecycle.ts is fully built — just needs wiring into handlers.ts.
- **Fix**: Write RED tests for each handler → implement handleCycleStart/Pull/Close.

## Ready for Next Session

1. Start with RED — write failing tests for all 3 gaps before any implementation
2. Fix Gap 3 first (most mechanical)
3. Decide artifact path/key convention, document inline
4. Fix Gap 2, then Gap 1
5. Backfill audit: MarkdownProjectionAdapter filesystem integration, writeCheckpointFile, txNext with real artifact/cycle expressions
6. Include skills/mattpocock/tdd/SKILL.md in agent prompts going forward
7. tx close once all gaps are green
