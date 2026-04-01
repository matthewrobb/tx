# twisted-workflow

A configurable orchestration layer for agentic development
with Claude Code — parallel execution, provider delegation,
session-independent state, and preset-based configuration.

## Project Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── src/                          ← runtime source
│   ├── cli/                      ← CLI entry point (index.ts) and filesystem layer (fs.ts)
│   ├── config/                   ← deepMerge, defaults, resolveConfig
│   ├── state/                    ← state machine, step sequencing
│   ├── notes/                    ← typed notes (decision, deferral, discovery, blocker)
│   ├── tasks/                    ← task CRUD and group assignment
│   ├── session/                  ← session lifecycle (pickup/handoff)
│   ├── artifacts/                ← artifact path resolution and listing
│   └── presets/                  ← typed preset definitions
├── build/                        ← tooling (generates skills, never read by Claude)
│   ├── build.ts                  ← bun run build
│   ├── lib/                      ← AST extraction, skill assembly
│   ├── skills/                   ← MarkdownDocument builders (2 files)
│   ├── schema/                   ← JSON Schema generator
│   ├── __tests__/                ← all tests (157)
│   └── __fixtures__/             ← test data
├── skills/                       ← generated SKILL.md (committed)
├── presets/                      ← generated preset JSON (committed)
├── schemas/                      ← generated JSON Schema (committed)
│   └── settings.schema.json
├── types/                        ← type definitions (18 .d.ts files)
├── README.md
└── CHANGELOG.md
```

## Architecture

`src/` is the source of truth. TypeScript functions with JSDoc
comments define all behavior. The build script extracts these
functions via the TypeScript compiler API and embeds them in
generated SKILL.md files as code blocks.

Generated skills tell Claude to "read first" the shared source
files and type definitions they depend on, then show the
skill-specific functions.

## Build

```
bun run build     # generates skills/, presets/, schemas/
bun test          # 157 tests across 17 files
```

## Pipeline

```
tx init        ← one-time setup
tx open        ← create objective, enters research step
  → research   ← delegatable (built-in or external provider)
  → scope      ← requirements interrogation
  → plan       ← issue breakdown and execution planning
  → build      ← implementation
  → close      ← QA, changelog, ship
```

`tx next` auto-advances the active objective one step at a time.

## tx CLI commands

```
tx init                      — setup .twisted/
tx open <objective>          — create objective
tx close [objective]         — final close step
tx next [objective]          — advance active objective one step
tx resume <objective>        — resume named objective
tx status [objective]        — show all or one objective

tx research [objective]      — run research step
tx scope [objective]         — run scope step
tx plan [objective]          — run plan step
tx build [objective]         — run build step

tx pickup [name]             — start a session
tx handoff [name]            — end a session
tx session status|save|list  — manage sessions

tx write <type> [obj]        — write artifact (from stdin)
tx read <type> [obj]         — read artifact (to stdout)
tx artifacts [obj]           — list artifacts

tx tasks [obj]               — list tasks
tx tasks add <summary>       — add a task
tx tasks update <id>         — update a task
tx tasks show <id>           — show task detail

tx note <summary>            — add a note
tx notes [obj]               — query notes

tx config [section] [sub]    — show config

Flags:
  -a, --agent       JSON output (for agent use)
  -y, --yolo        skip confirmations
  -o, --objective   target a specific objective
```

## Config Resolution

Three-layer sparse override system with composable presets:

```
deepMerge(defaults, ...presets.reverse().map(load), projectSettings ?? {})
```

First preset wins — put the most important one first.
Built-in presets: twisted, superpowers, minimal.

## Artifacts

State and artifacts are stored as JSON files under `.twisted/{lane}/{objective}/`:

| File | Purpose |
|---|---|
| `state.json` | Objective state (step, status, progress) |
| `tasks.json` | Task list |
| `notes.json` | Typed notes (decision, deferral, discovery, blocker) |
| `sessions/active.json` | Active session |
| `sessions/{n}-{name}.md` | Saved session summaries |
| `research/` | Research artifacts |

Agents write and read artifacts via `tx write <type>` and `tx read <type>`.
