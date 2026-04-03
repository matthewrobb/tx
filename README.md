# twisted-workflow

Data-driven workflow engine for agentic development with Claude Code — issue/cycle model, expression-based DAG engine, PGLite storage, and daemon architecture.

## How It Works

Claude Code sessions end. Context resets. Work disappears.

twisted-workflow stores all state in PGLite (embedded Postgres) and projects it to `.twisted/` as markdown files for humans and git. Start a session with `tx pickup`, work, end it with `tx handoff` — the next session picks up exactly where you left off.

The engine is **data-driven**: workflows are DAGs of steps with expression-based conditions. `tx next` evaluates those conditions against vars, tasks, artifacts, and cycle state, then advances automatically.

## Quick Start

```bash
npm install -g twisted-workflow

tx init                    # Initialize .twisted/ in your project
tx open my-feature --type feature   # Create a new epic
tx ready my-feature        # Move to 1-ready (estimate it)
tx estimate my-feature --size M --rationale "medium scope"
tx next                    # Advance through the pipeline
tx status                  # Check all epics
```

## The Pipeline

Issues have workflows — DAGs of steps that advance when expression conditions are met:

| Workflow | Steps | Default for |
|----------|-------|-------------|
| `feature` | research → scope → plan → build | feature |
| `bug` | reproduce → fix → verify | bug |
| `chore` | do | chore |
| `spike` | research → recommend | spike |

Cycles are optional focus containers. Pull issues into a cycle, work through them, close with retro + checkpoint.

## Commands

```bash
# Issues
tx issue open <slug> [--type <type>]   # Create issue
tx issue close <slug>                  # Close issue
tx next [issue]                        # Advance issue one step
tx status [issue]                      # Show all or detail for one

# Cycles
tx cycle start <slug> <title>          # Start a cycle
tx cycle pull [slugs...]               # Pull issues into active cycle
tx cycle close <summary>               # Close cycle (retro + checkpoint)

# Dependencies
tx install [package] [--force]         # Install from settings or by name
tx uninstall <package>                 # Remove package + manifest entry
tx manifest write                      # Write manifest from stdin (JSON)
tx manifest show                       # Show current manifest

# Artifacts
tx write <type> --issue <slug>         # Write artifact (stdin)
tx read <type> --issue <slug>          # Read artifact (stdout)

# Notes
tx note <summary>                      # Add note (--decide|--defer|--discover|--blocker)

# Sessions
tx pickup [name]                       # Start a session
tx handoff                             # End session
tx checkpoint <summary>                # Create context checkpoint

# Setup
tx init                                # Guided project setup
tx config                              # Show config

# Flags
-a, --agent       # JSON output (AgentResponse)
-y, --yolo        # Skip confirmations
-v, --version     # Show version
```

## State Model

All state lives in PGLite. Markdown files under `.twisted/` are read-only projections:

```
.twisted/
├── settings.json            # Project config overrides
├── issues/                  # Projected issue markdown
│   └── {slug}.md
├── cycles/                  # Projected cycle markdown
│   └── {slug}.md
├── checkpoints/             # Context bridges between sessions
│   └── {n}-{id}.md
└── snapshot.md              # All issues at a glance
```

DB lives in `~/.twisted/projects/{id}/` (out of repo). Installed packages in `~/.twisted/projects/{id}/node_modules/`.

## Configuration

Settings live in `.twisted/settings.json`. Two-layer merge:

```
deepMerge(defaults, projectSettings)
```

`settings.json` stores only your overrides — all fields optional.

```json
{
  "$schema": "./schemas/settings.schema.json",
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  }
}
```

## Agent Use

Every `tx` command with `-a` returns a typed JSON response:

```ts
interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  epic?: CoreState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}

type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: AgentAssignment[] }
  | { type: "install_cli"; instructions: string };
```

Agents read `action` to know what to do next:

- `"invoke_skill"` — load the named skill
- `"prompt_user"` — execute the step described in `prompt`
- `"done"` — pipeline complete
- `"confirm"` — display message, run `next_command` to proceed

## Development

```bash
npm install          # install dependencies
npm run build        # generate skills/, schemas/
npm run build:cli    # compile tx binary to dist/
npm test             # 415 tests across 37 files
```

**Runtime** (`src/`):

| Module | Purpose |
|---|---|
| `src/cli/` | CLI (commander), command modules |
| `src/engine/` | Expression evaluator, DAG resolver, XState generator, `txNext()` |
| `src/daemon/` | TwistedDaemon server, handlers, projection flusher |
| `src/adapters/pglite/` | PGLite storage adapter |
| `src/adapters/markdown/` | Markdown projection adapter |
| `src/adapters/npm/` | Package resolver, manifest, config merge |
| `src/issues/` | Issue CRUD, hierarchy, auto-close |
| `src/cycles/` | Cycle lifecycle, retro generation |
| `src/checkpoints/` | Checkpoint CRUD, projection |
| `src/config/` | Config resolution, defaults, validator |
| `src/types/` | All type definitions with barrel export |

## Skill Packages

Skills are installed as dependencies, not bundled. Declare them in `.twisted/settings.json`:

```json
{
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  }
}
```

Run `tx install` to clone/install. The agent analyzes each SKILL.md and generates a manifest with detected external outputs and override suggestions (redirecting GitHub issues to `tx issue`, file writes to `tx write`, etc.).

```bash
tx install                   # install all from settings
tx install --force           # fresh reinstall
tx uninstall <package>       # remove package + manifest
tx manifest show             # inspect the manifest
```

## Contributing

Issues and pull requests welcome at [matthewrobb/twisted-workflow](https://github.com/matthewrobb/twisted-workflow).

## License

MIT
