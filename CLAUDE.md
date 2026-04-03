# twisted-workflow

Data-driven workflow engine for agentic development with Claude Code —
issue/cycle model, expression-based DAG engine, PGLite storage, and
daemon architecture.

## Project Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .claude/skills/dogfood/       ← project-local /dogfood skill
├── src/                          ← runtime source
│   ├── cli/                      ← CLI entry, command modules
│   │   └── commands/             ← issue, cycle, note, session, config, install, manifest, init
│   ├── config/                   ← deepMerge, defaults, resolveConfig, validator
│   ├── engine/                   ← expression evaluator, DAG resolver, XState generator, txNext
│   │   └── expressions/          ← parser, evaluator, context builders, interactive functions
│   ├── daemon/                   ← TwistedDaemon server, handlers, projection flusher
│   ├── adapters/
│   │   ├── pglite/               ← PGLite storage adapter (StoragePort)
│   │   ├── markdown/             ← Markdown projection adapter (ProjectionPort)
│   │   ├── socket/               ← Unix/named-pipe transport (TransportPort)
│   │   └── npm/                  ← Package resolver, manifest, config merge
│   ├── ports/                    ← StoragePort, ProjectionPort, TransportPort, PackageResolverPort
│   ├── issues/                   ← Issue CRUD, hierarchy, auto-close
│   ├── cycles/                   ← Cycle lifecycle, retro generation
│   ├── checkpoints/              ← Checkpoint CRUD, projection
│   ├── setup/                    ← Guided init flow
│   └── types/                    ← All type definitions + index.ts barrel
├── build/                        ← tooling (generates skills/schemas)
│   ├── build.ts
│   ├── lib/                      ← AST extraction, skill assembly
│   ├── skills/                   ← skill content builder
│   └── schema/                   ← JSON Schema generator
├── skills/tx/                    ← generated SKILL.md (committed)
├── schemas/                      ← generated JSON Schema (committed)
│   └── settings.schema.json
├── README.md
└── CHANGELOG.md
```

## Architecture

`src/` is the source of truth. The engine is data-driven: workflows are
DAGs of steps, each declaring `needs` (predecessors), `produces` (artifacts),
and expression-based conditions (`done_when`, `skip_when`, `block_when`).
`txNext()` evaluates expressions against a context of vars, tasks, artifacts,
and cycle state, then advances automatically.

All state lives in PGLite (embedded Postgres via WASM). The daemon owns the
DB exclusively. The CLI is a thin socket client. Markdown projection is a
read-only view for humans and git commits.

Types live in `src/types/` with an `index.ts` barrel — import from
`../types/index.js` to get everything.

## Build

```
npm run build       # generate skills/, schemas/
npm run build:cli   # compile tx binary to dist/
npm test            # 415 tests across 37 files
```

## Workflow Model

Issues have workflows (DAGs of steps). Default workflows:

| Workflow | Steps | Default for |
|----------|-------|-------------|
| `feature` | research → scope → plan → build | feature |
| `bug` | reproduce → fix → verify | bug |
| `chore` | do | chore |
| `spike` | research → recommend | spike |

Steps advance when `done_when` expressions evaluate true. `tx next` runs
the engine — no manual step tracking needed.

Cycles are optional focus containers. Start a cycle, pull issues in, close
with retro + checkpoint.

## tx CLI commands

```
tx init                              — guided project setup
tx next [issue]                      — advance issue one step (engine-driven)
tx status [issue]                    — show all issues or detail for one

tx issue open <slug> [--type <type>] — create issue
tx issue close <slug>                — close issue

tx cycle start <slug> <title>        — start a cycle
tx cycle pull [issue_slugs...]       — pull issues into active cycle
tx cycle close <summary>             — close cycle (retro + checkpoint)

tx install [package] [--force]       — install skill packages from deps or by name
tx uninstall <package>               — remove installed package + manifest entry
tx manifest write                    — write skill manifest from stdin (JSON)
tx manifest show                     — show current skill manifest

tx write <type> --issue <slug>       — write artifact (stdin)
tx read <type> --issue <slug>        — read artifact (stdout)

tx note <summary> [--decide|--defer|--discover|--blocker|--retro]
tx notes [issue]                     — query notes

tx pickup [name]                     — start session
tx handoff                           — end session
tx checkpoint <summary>              — create context checkpoint

tx config                            — show config

Flags:
  -a, --agent       JSON output (AgentResponse)
  -y, --yolo        skip confirmations
  -v, --version     show version
```

## Dependencies

Skill packages are declared in `.twisted/settings.json`:

```json
{
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  }
}
```

`tx install` clones/installs packages to `~/.twisted/projects/{id}/node_modules/`.
For git repos without `package.json`, it creates a synthetic manifest by scanning
for SKILL.md files. After install, the agent analyzes each skill and writes a
`skill-manifest.json` with detected outputs and override suggestions via
`tx manifest write`.

## Config Resolution

Two-layer merge: defaults + project settings.

```
deepMerge(defaults, projectSettings ?? {})
```

`settings.json` stores only your overrides — all fields optional.

## Dogfooding

The `/dogfood` skill automates the build → test → commit → worktree sync cycle
for local development. The global `tx` binary is npm-linked to
`.claude/worktrees/twisted-workflow/`, so the worktree merge is what makes
changes visible to the CLI.
