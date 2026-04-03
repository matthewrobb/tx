# v4.1.0 — TDD Gaps, Backfill Audit, Dependency Management

## What shipped

### Engine fixes (TDD gaps from v4.0.0)
- **Cycle daemon handlers**: `cycle_start`, `cycle_pull`, `cycle_close` wired to existing lifecycle functions via `handleCycleStart/Pull/Close`
- **Cycle context**: `buildContext()` now queries the active cycle from PGLite instead of hardcoding `null` — expressions like `cycle.status == 'active'` work
- **Artifact context**: `buildContext()` loads the current step's `produces` array and checks the vars table for present artifacts — `artifacts.all_present` works end-to-end
- **Artifact key convention**: `StepArtifact.path` = var key (aligned with `handleWrite`'s `req.type`)

### Backfill tests
- `MarkdownProjectionAdapter`: filesystem integration tests for `renderCycle`, `renderCheckpoint`, `renderSnapshot`, `deleteIssue` (9 tests)
- `writeCheckpointFile`: filename convention, idempotency, issue_slug (4 tests)

### Dependency management
- `tx install [package] [--force]` — installs from `.twisted/settings.json` dependencies or by name
- `tx uninstall <package>` — removes package directory + manifest entry
- `tx manifest write` / `tx manifest show` — manage skill manifest via CLI
- `github:` spec support — shallow clones git repos, discovers SKILL.md files, writes synthetic `package.json`
- Agent-driven manifest analysis: after install, returns a `prompt_user` action instructing the agent to read each SKILL.md, detect external outputs (GitHub issues, PRs, file writes, git ops), and generate override suggestions

### Vendor removal
- Removed `skills/mattpocock/` (vendored copies) and `build/skills/vendor.ts`
- Skills now declared as dependencies: `"@mattpocock/skills": "github:mattpocock/skills"`

### Other
- `/dogfood` project-local skill for build → test → commit → worktree sync
- `dependencies` field added to `TwistedConfig` type and JSON schema
- `tx skills` — list installed skills from manifest
- `tx config merge` — deep-merge JSON from stdin into settings.json
- `tx config show` — show resolved config (renamed from `tx config`)
- `filterUnboundSkills()` — skip already-configured skills on re-install (4 tests)
- Feature workflow extended with `decompose` step (plan → decompose → build)
- All steps configured with `produces`, `done_when`, and step skill bindings
- TECHNICAL-DESIGN.md — narrative technical article covering full architecture
- `/dogfood` project-local skill for build → test → commit → worktree sync
- 382 → 422 tests (40 new), all green

---

# Retro: mattpocock-skills-integration

## What shipped

- `step_skills` and `step_review_skills` config maps on `TwistedConfig` — sparse per-step skill overrides that merge cleanly into defaults
- `review_skill` and `context_skills` fields on `AgentResponse` — agent-readable signal for pre/post-step skill dispatch
- `tx scope`, `tx plan`, `tx build` now emit `invoke_skill` by default pointing to bundled mattpocock skills
- `tx decompose` command added — was missing, blocked `prd-to-issues` dispatch
- `build/skills/vendor.ts` — auto-clones `mattpocock/skills` if absent, copies with provenance headers into `skills/mattpocock/`
- `grill-me` wired as opt-in `review_skill` on `plan` — agent asks before advancing
- `context_skills` consumer finally wired after living as an orphan field
- README attribution + SKILL.md dispatch documentation

## What went well

- grill-me review caught two real scope issues: dropped the redundant `StepConfig.skill` dual-write, dropped the unnecessary `DeepPartial` change
- Build-time vendor copy model is clean — MIT attribution, no runtime dependency on the clone
- All 107 tests passed without changes to the test suite

## What was hard

- The `1-ready` lane gate (plan.md → estimate-tasks → decompose required before activating) was unexpected and caused friction — had to manually reset state.json twice
- `tx research` blocked because epic step was "plan" not "research" after `tx ready` — ready lane has its own "plan" step that shadows the backlog "plan"
- No `tx rewind` / `tx reset-lane` command — had to manually edit state.json

## Backlog candidates

- Lane model documentation: `1-ready` gate steps are undocumented in CLAUDE.md
- `tx rewind` or `tx reset-lane` command to move an epic back without manual state.json editing
- `estimate-tasks` CLI command (currently missing)
- The 8 deferred notes from the v4 conversation (planning poker, agent personas, tx commit wrapper, Ralph, daemon, cross-epic deps, human-team features, v3 deferrals)
