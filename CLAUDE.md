# twisted-workflow

Artifact-driven orchestration for agentic development with Claude Code —
6-lane epic lifecycle, XState engine, story tier, and session-independent state.

## Project Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── src/                          ← runtime source
│   ├── cli/                      ← CLI entry (index.ts), command modules, fs layer
│   │   └── commands/             ← lifecycle, steps, tasks, notes, session, artifacts, epic, config
│   ├── config/                   ← deepMerge, defaults, resolveConfig
│   ├── engine/                   ← artifact evaluator, predicates, XState machine, txNext
│   ├── daemon/                   ← on-demand daemon server/client (sock-daemon)
│   ├── stories/                  ← story CRUD (epic → story → task)
│   ├── agents/                   ← .claude/agents/ symlink generation
│   └── types/                    ← all type definitions + index.ts barrel
├── build/                        ← tooling (generates skills/schemas, never read by Claude)
│   ├── build.ts                  ← npm run build
│   ├── lib/                      ← AST extraction, skill assembly
│   ├── skills/                   ← skill content builder
│   ├── schema/                   ← JSON Schema generator
│   ├── __tests__/                ← all tests
│   └── __fixtures__/             ← test data
├── skills/                       ← generated SKILL.md (committed)
├── schemas/                      ← generated JSON Schema (committed)
│   └── settings.schema.json
├── README.md
└── CHANGELOG.md
```

## Architecture

`src/` is the source of truth. The engine is artifact-driven: each step
declares what files it produces (`produces`), what it requires (`requires`),
and what conditions mark it complete (`exit_when`). `txNext()` evaluates
these conditions and advances automatically.

Types live in `src/types/` with an `index.ts` barrel — import from
`../types/index.js` to get everything.

## Build

```
npm run build       # generate skills/, schemas/
npm run build:cli   # compile tx binary to dist/
npm test            # 109 tests across 14 files
```

## Lane Model

Epics move through 6 lanes. Default sequence for a `feature`:

```
0-backlog → 1-ready → 2-active → 4-done
```

Within `2-active`, steps advance when artifacts are written:

```
research → scope → plan → decompose → build
```

`tx next` runs the engine — no manual step tracking needed.

## tx CLI commands

```
tx init                              — setup .twisted/ and .claude/agents/
tx open <epic> [--type <type>]       — create epic in 0-backlog
tx ready <epic>                      — move to 1-ready
tx next [epic]                       — advance active epic one step (engine-driven)
tx close [epic]                      — retro + ship
tx resume <epic>                     — resume at current step
tx status [epic]                     — show all epics or detail for one
tx archive <epic> [--reason]         — move to 5-archive

tx research|scope|plan|build [epic]  — run named step

tx estimate <epic> --size --rationale [--timebox] [--confidence]
tx promote <epic> --type <type>      — convert spike to another type

tx stories <epic> [add|done|show]    — story CRUD
tx backlog [promote <id>]            — retro backlog candidates

tx pickup [name]                     — start session
tx handoff                           — end session
tx session status|save|list          — manage sessions

tx write <type> [epic]               — write artifact (stdin)
tx read <type> [epic]                — read artifact (stdout)
tx artifacts [epic]                  — list artifacts

tx tasks [epic]                      — list tasks
tx tasks add <summary>               — add task (T-001 format)
tx tasks update <T-001> [--done]     — update task
tx tasks show <T-001>                — show task detail

tx note <summary> [--decide|--defer|--discover|--blocker|--retro]
tx notes [epic]                      — query notes

tx config                            — show config

Flags:
  -a, --agent       JSON output (for agent use)
  -y, --yolo        skip confirmations
  -e, --epic        target a specific epic
```

## Config Resolution

Two-layer merge: defaults + project settings.

```
deepMerge(defaults, projectSettings ?? {})
```

`settings.json` stores only your overrides — all fields optional.

## Artifacts

State and artifacts live under `.twisted/{lane}/{epic}/`:

| File | Purpose |
|---|---|
| `state.json` | CoreState (lane, step, type, status) |
| `tasks.json` | TaskV4 list (T-001 format) |
| `stories.json` | Story list (from decompose step) |
| `notes.json` | Typed notes |
| `estimate.json` | Size, confidence, rationale |
| `research/research.md` | Research artifact |
| `scope.md` | Scope artifact |
| `plan.md` | Plan artifact |
| `retro.md` | Retrospective (generated at close) |
| `backlog-candidates.json` | Promoted retro items |
| `sessions/active.json` | Active session |
| `sessions/{n}-{name}.md` | Saved session summaries |

Agents write artifacts via `tx write <type>` and read via `tx read <type>`.
