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
