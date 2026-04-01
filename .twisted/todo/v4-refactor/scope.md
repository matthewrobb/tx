# v4-refactor Scope

## Decision Summary

| Area | Decision |
|---|---|
| Phasing | Multi-phase delivery |
| Runtime switch | Phase 0 prerequisite (full: Node.js + npm + vitest + build) |
| Daemon | Phase 1 — `sock-daemon` with `proper-lockfile` fallback, ships with core engine |
| State machine | XState v5 |
| tx commit + git hooks | Deferred — orthogonal to core engine |
| Agent generation | MVP form only |
| tx migrate | Scrapped — not needed |
| Stories (epic→story→task) | Deferred to final phase, after core engine works |
| Skill rename | "twisted-work" → "tx" to match CLI tool name |
| Agent output | `-a` responses use Claude Code idioms (`/tx next`, tool names, not raw CLI) |

## Phases

### Phase 0: Runtime Switch
**Goal:** Replace Bun with Node.js across the entire toolchain.
- Node.js >= 20 as runtime
- npm replaces bun as package manager (package.json scripts, lockfile)
- vitest replaces bun test
- Build script updated for Node.js/npm execution
- All 157 tests passing on new stack before proceeding

### Phase 1: Core Engine + Lane Model
**Goal:** Artifact-driven engine with lane filesystem model and epic types.

**In scope:**
- Artifact-driven step completion (no boolean flags in state.json)
- Lane model: `0-backlog → 1-ready → 2-scoped → 3-started → 4-done → 5-archived`
- Lane directories on filesystem; `tx next` auto-advances via artifact presence
- Human gates: `tx ready` (backlog→ready), `tx archive` (→archived)
- Epic types: feature, technical, bug, spike, chore — each with distinct pipeline config
- New CoreState schema: adds `type`, `lane`, `disposition`, `promoted_to`
- Config schema v4: `version: 4`, lanes, steps with `produces[]`/`requires[]`, types, artifact predicates
- XState v5 epicMachine: evaluating → running → advancingLane → blocked/complete/failed/archived
- Persisted XState snapshots in state.json
- Terminology rename: "objective" → "epic", `-o` → `-e`
- Skill rename: "twisted-work" → "tx"
- Agent output (`-a`) uses Claude Code idioms throughout:
  - References use skill syntax: `/tx next`, `/tx status`, not bare `tx` commands
  - Actions reference Claude Code tools by name (AskUserQuestion, Agent, etc.) where appropriate
  - Display text written for Claude Code consumption, not human terminal use
- Clean CLI/engine separation (CLI layer calls engine; engine has no CLI concerns)
- Predicate system: `tasks.all_done`, `tasks.any_done`, `tasks.any_committed`, `tasks.count >= N`
- On-demand daemon via `sock-daemon` — one per machine, project-aware, idle timeout (default 5 min)
- `server.json` written to `.twisted/` on startup
- Parallel `tx` invocations serialized through daemon
- No lockfile fallback — trust `sock-daemon` auto-start; socket failure = hard error

**New commands:** `tx ready`, `tx archive`
**Modified commands:** all existing commands updated for epic terminology + lane model

### Phase 2: Estimation + Spike Promotion + Retro Loop
**Goal:** Add estimation, spike lifecycle, and feedback loop.

**In scope:**
- Estimation step in `1-ready` lane, produces `estimate.json`
- Two dimensions: story_points (Fibonacci) + effort (XS–XL) + confidence
- Spike-specific: timebox field
- `tx promote <spike> --type feature` — mutates in place, carries artifacts, skips satisfied steps
- `tx estimate` command
- Retro notes (`type: "retro"`) written by task agents
- `tx close` aggregates retro notes → `retro.md` → backlog candidates
- `tx backlog promote <note-id>` — promote candidate to new epic

### Phase 3: Stories + Agent MVP
**Goal:** Add story tier and minimal agent file generation.

**In scope:**
- Epic → story → task hierarchy (feature + technical types only)
- `stories.json` produced by `decompose` step in `2-scoped`
- Story schema: id, summary, acceptance_criteria[], status, story_points, tasks[]
- Task schema gets `story_id` for traceability
- `tx stories` command
- Agent file generation (MVP): minimal `.claude/agents/` files generated from config
- Agent roles: build, planning, retro, review, research (simplified)

## Deferred (out of scope for all phases)

- **tx commit + git hooks** — commit formatting, commit-msg hook enforcement. Bolt on after core ships.
- **tx migrate** — no v3→v4 migration needed, starting fresh.
- **Everything in spec's deferred list** — planning poker, personas, cross-epic deps, sprints, velocity, web UI, multi-user.

## Constraints

- Each phase must leave the system usable — no half-working states between phases
- Phase 0 is a prerequisite; Phases 1–3 are sequential
- XState v5 is the state machine — no fallback to plain reducers
- CLI/engine boundary must be clean: CLI → daemon (or direct engine fallback) → engine
- Artifact-driven completion is the core invariant — no boolean progress flags anywhere
