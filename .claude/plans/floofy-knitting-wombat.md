# v4-refactor Plan

## Context

twisted-workflow v3 has a 5-step linear pipeline with boolean state tracking. v4 redesigns this into an artifact-driven engine with 6 filesystem lanes, 5 epic types, XState v5, and a daemon. The scope defined 4 phases (P0-P3), each leaving the system usable.

Key codebase observations:
- All 17 test files import `"bun:test"`, CLI integration tests use `Bun.spawnSync`
- `tsconfig.json` uses Bun-specific `"moduleResolution": "bundler"`
- `src/cli/index.ts` is a 560-line monolith — must be split in Phase 1
- `src/scope/`, `src/decompose/`, `src/execute/`, `src/strategies/`, `src/pipeline/`, `src/work/` are design sketches with unimplemented functions — delete in P1
- Only `src/cli/`, `src/config/`, `src/state/`, `src/notes/`, `src/tasks/`, `src/session/`, `src/artifacts/`, `src/presets/` contain working code

---

## Phase 0: Runtime Switch (10 tasks)

**Goal**: Bun -> Node.js + npm + vitest. All tests passing.
**Exit**: `npm test` passes, `npm run build` works, CLI runs under node.

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P0-01 | Add vitest devDep, create vitest.config.ts | package.json, vitest.config.ts | - | XS |
| P0-02 | Replace bun.lock with package-lock.json | package-lock.json | P0-01 | XS |
| P0-03 | Update package.json scripts for node/npm | package.json | P0-01 | XS |
| P0-04 | Update tsconfig.json: NodeNext module resolution | tsconfig.json | - | S |
| P0-05 | Convert 17 test files: bun:test -> vitest | build/__tests__/*.test.ts | P0-01 | M |
| P0-06 | Convert CLI tests: Bun.spawnSync -> execSync | build/__tests__/cli-integration.test.ts | P0-05 | M |
| P0-07 | Remove @types/bun from devDeps | package.json | P0-05 | XS |
| P0-08 | Update build/build.ts for node (replace Bun APIs) | build/build.ts | P0-04 | S |
| P0-09 | Update tsconfig.cli.json for NodeNext | tsconfig.cli.json | P0-04 | XS |
| P0-10 | Run full suite, fix remaining failures | * | all | M |

**Groups**: A(P0-01..03) | B(P0-04,09) | C(P0-05..07, needs A) | D(P0-08, needs B) | E(P0-10, needs all)
**Critical path**: P0-01 -> P0-05 -> P0-06 -> P0-10

**Risks**:
- `import.meta.dirname` needs Node 21.2+ — may need `path.dirname(fileURLToPath(import.meta.url))` for Node 20
- Bun-lenient import resolution may surface errors under NodeNext

---

## Phase 1: Core Engine + Lane Model (39 tasks)

**Goal**: Artifact-driven engine, 6-lane filesystem, epic types, XState v5, daemon, clean CLI/engine split.
**Exit**: `tx open --type feature`, `tx ready`, `tx next` (artifact-driven), `tx archive` all work. Daemon runs. Skill renamed to "tx".

### Types (P1-01 to P1-09)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-01 | Define v4 CoreState replacing ObjectiveState | types/state.d.ts | P0 | M |
| P1-02 | Define v4 config types: Settings, LaneConfig, StepConfig, TypeConfig, ArtifactRef, PredicateRef | types/config.d.ts | P0 | L |
| P1-03 | Define EpicType union and type-specific pipeline configs | types/epic.d.ts (new) | P0 | S |
| P1-04 | Define engine types: StepStatus, StepEvaluation, EngineResult | types/engine.d.ts (new) | P1-02 | M |
| P1-05 | Define XState context/event types | types/xstate.d.ts (new) | P1-04 | S |
| P1-06 | Update AgentResponse/AgentAction for v4 | types/output.d.ts | P1-01 | S |
| P1-07 | Update command types: ready, archive, -e flag | types/commands.d.ts | P1-01 | S |
| P1-08 | Add "retro" to NoteType union | types/notes.d.ts | P0 | XS |
| P1-09 | Update Task type: string id (T-001), story_id, commit | types/tasks.d.ts | P0 | S |

### Config (P1-10 to P1-12)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-10 | Write v4 defaults.ts (version:4, lanes, steps, types) | src/config/defaults.ts | P1-02,03 | L |
| P1-11 | Update resolve.ts for v4 config shape | src/config/resolve.ts | P1-10 | M |
| P1-12 | Update presets for v4 | src/presets/*.ts | P1-10 | S |

### Engine Core (P1-13 to P1-19)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-13 | Implement artifactSatisfied(): file existence + predicates | src/engine/artifacts.ts (new) | P1-02 | M |
| P1-14 | Implement predicate evaluator (tasks.all_done, etc.) | src/engine/predicates.ts (new) | P1-13 | M |
| P1-15 | Implement step evaluator: evaluate steps -> StepEvaluation[] | src/engine/evaluate.ts (new) | P1-13,14 | M |
| P1-16 | Implement lane advancement: check entry_requires, compute next lane | src/engine/lanes.ts (new) | P1-15 | M |
| P1-17 | Install xstate v5, implement epicMachine | src/engine/machine.ts (new) | P1-05,15,16 | XL |
| P1-18 | Implement XState persistence: save/restore snapshots | src/engine/persist.ts (new) | P1-17 | M |
| P1-19 | Implement txNext(): create actor, rehydrate, run, persist | src/engine/next.ts (new) | P1-17,18 | L |

### Filesystem (P1-20 to P1-21)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-20 | Rewrite fs.ts for lane model: numeric-prefix dirs, moveDir | src/cli/fs.ts | P1-01 | L |
| P1-21 | Implement findEpics() scanning all 6 lane dirs | src/cli/fs.ts | P1-20 | S |

### CLI (P1-22 to P1-27)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-22 | Extract engine interface: Engine type + facade | src/engine/index.ts (new) | P1-19 | M |
| P1-23 | Rewrite CLI index.ts: thin dispatcher calling engine | src/cli/index.ts | P1-22,20 | XL |
| P1-24 | Implement `tx ready <epic>` command | src/cli/index.ts | P1-23 | S |
| P1-25 | Implement `tx archive <epic> --reason` command | src/cli/index.ts | P1-23 | S |
| P1-26 | Update args.ts: -o -> -e, --type, new subcommands | src/cli/args.ts | P1-07 | M |
| P1-27 | Update output: "objective" -> "epic", /tx syntax, CC idioms | src/cli/output.ts | P1-23 | M |

### Daemon (P1-28 to P1-30)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-28 | Install sock-daemon, implement daemon server | src/daemon/server.ts (new) | P1-22 | L |
| P1-29 | Implement daemon client: connect-or-spawn | src/daemon/client.ts (new) | P1-28 | M |
| P1-30 | server.json lifecycle: create/delete/stale detection | src/daemon/lifecycle.ts (new) | P1-28 | S |

### Build + Skill (P1-31 to P1-32)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-31 | Rename skill "twisted-work" -> "tx", update build + plugin | build/skills/, .claude-plugin/ | P1-27 | M |
| P1-32 | Update build.ts for v4 skill + schema generation | build/build.ts | P1-31 | S |

### Tests (P1-33 to P1-37)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-33 | Write engine unit tests: artifacts, predicates, evaluation | build/__tests__/engine-evaluate.test.ts (new) | P1-15 | L |
| P1-34 | Write XState machine tests: transitions, persistence | build/__tests__/engine-machine.test.ts (new) | P1-18 | L |
| P1-35 | Write v4 config resolution tests | build/__tests__/config-resolve.test.ts | P1-11 | M |
| P1-36 | Write v4 CLI integration tests | build/__tests__/cli-integration.test.ts | P1-23 | L |
| P1-37 | Update remaining v3 tests for v4 APIs | build/__tests__/*.test.ts | P1-23 | M |

### Cleanup (P1-38 to P1-39)

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P1-38 | Delete dead v3 source: scope/, decompose/, execute/, strategies/, pipeline/, work/ | remove 20 files | P1-23 | S |
| P1-39 | Remove dead v3 types: pipeline, execution, phases, flow, decompose, templates, strings, tools, directories | types/ cleanup | P1-02 | M |

**Critical path**: P0 -> P1-02 -> P1-04 -> P1-13 -> P1-15 -> P1-17 -> P1-19 -> P1-22 -> P1-23 -> P1-36

**Risks**:
- **XState v5 API**: Verify `setup()`, `fromPromise()`, `always` transitions work as spec describes
- **sock-daemon**: Verify Windows support — if broken, fallback to direct engine calls (no serialization)
- **Directory moves on Windows**: Use `fs-extra moveSync`, not `fs.renameSync`
- **CLI rewrite (P1-23)**: Largest single task — split into per-command handlers if needed

---

## Phase 2: Estimation + Spike Promotion + Retro (12 tasks)

**Goal**: Estimation step, spike lifecycle, retrospective feedback loop.
**Exit**: `tx estimate` works, `tx promote` converts spikes, `tx close` generates retro.md + candidates.

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P2-01 | Define EstimateFile type | types/estimate.d.ts (new) | P1 | S |
| P2-02 | Add estimate step to v4 defaults (1-ready lane) | src/config/defaults.ts | P2-01 | S |
| P2-03 | Implement `tx estimate` command | src/cli/index.ts | P2-02 | M |
| P2-04 | Define RetroNote/BacklogCandidate types | types/notes.d.ts | P1-08 | S |
| P2-05 | Implement retro note aggregation -> retro.md | src/engine/retro.ts (new) | P2-04 | M |
| P2-06 | Update `tx close` for retro aggregation | src/cli/index.ts, src/engine/ | P2-05 | M |
| P2-07 | Implement `tx backlog promote <note-id>` | src/cli/index.ts | P2-06 | M |
| P2-08 | Implement `tx promote <spike> --type`: mutate, recompute, move | src/engine/promote.ts (new) | P1-16,19 | L |
| P2-09 | Add timebox field to estimate schema for spikes | types/estimate.d.ts | P2-01 | XS |
| P2-10 | Write estimation tests | build/__tests__/estimation.test.ts (new) | P2-03 | M |
| P2-11 | Write spike promotion tests | build/__tests__/promote.test.ts (new) | P2-08 | M |
| P2-12 | Write retro loop tests | build/__tests__/retro.test.ts (new) | P2-07 | M |

**Critical path**: P1 -> P2-04 -> P2-05 -> P2-06 -> P2-07 -> P2-12

---

## Phase 3: Stories + Agent MVP (10 tasks)

**Goal**: Story tier (epic -> story -> task), agent file generation.
**Exit**: `tx stories` works, `stories.json` from decompose step, agents generated in `.claude/agents/`.

| ID | Summary | Files | Deps | Size |
|---|---|---|---|---|
| P3-01 | Define Story/StoriesFile types | types/stories.d.ts (new) | P2 | S |
| P3-02 | Add story_id to Task type | types/tasks.d.ts | P3-01 | XS |
| P3-03 | Add decompose step config (produces stories.json) | src/config/defaults.ts | P3-01 | S |
| P3-04 | Implement stories CRUD | src/stories/stories.ts (new) | P3-01 | M |
| P3-05 | Implement `tx stories` command | src/cli/index.ts | P3-04 | M |
| P3-06 | Add readStories/writeStories to fs.ts | src/cli/fs.ts | P3-01 | S |
| P3-07 | Install symlink-dir, implement agent generation | src/agents/generate.ts (new) | P1-10 | L |
| P3-08 | Update `tx init` for agent generation + symlink | src/cli/index.ts | P3-07 | M |
| P3-09 | Write story tests | build/__tests__/stories.test.ts (new) | P3-05 | M |
| P3-10 | Write agent generation tests | build/__tests__/agents.test.ts (new) | P3-08 | M |

**Critical path**: P2 -> P3-01 -> P3-04 -> P3-05 -> P3-09

---

## New Dependencies

| Package | Phase | Purpose |
|---|---|---|
| vitest (dev) | P0 | Test runner |
| xstate@^5.20.0 | P1 | State machine |
| sock-daemon@^1.x | P1 | On-demand daemon |
| fs-extra@^11.x | P1 | Lane dir moves |
| symlink-dir@^6.x | P3 | Agent symlinks |

## New Files (28)

Phase 0: `vitest.config.ts`
Phase 1: `types/{epic,engine,xstate}.d.ts`, `src/engine/{artifacts,predicates,evaluate,lanes,machine,persist,next,index}.ts`, `src/daemon/{server,client,lifecycle}.ts`
Phase 2: `types/estimate.d.ts`, `src/engine/{retro,promote}.ts`
Phase 3: `types/stories.d.ts`, `src/stories/stories.ts`, `src/agents/generate.ts`
Tests: 7 new test files across phases

## Deleted Files (20, Phase 1)

`src/{scope,decompose,execute,strategies,pipeline,work}/` — design sketches and v3 code replaced by engine

## Verification

Each phase has its own exit criteria (above). Cross-phase verification:
1. `npm test` passes after each phase
2. `npm run build` generates skills/presets/schemas after P1+
3. Manual smoke test: `tx init && tx open test-epic --type feature && tx ready test-epic && tx next` after P1
4. Daemon test: run two `tx status` in parallel after P1
