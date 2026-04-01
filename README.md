# twisted-workflow

A configurable orchestration layer for agentic development with Claude Code — parallel execution, provider delegation, session-independent state, and preset-based configuration.

## How It Works

Claude Code sessions end. Context resets. Work disappears.

twisted-workflow stores every objective in a `.twisted/` directory organized as a kanban board: `todo/`, `in-progress/`, `done/`. Each objective carries its own state, tasks, notes, research, and session history as JSON. Start a session with `tx pickup`, work, end it with `tx handoff` — the next session picks up exactly where you left off.

## Quick Start

```bash
npm install -g twisted-workflow

tx init                    # Initialize .twisted/ in your project
tx open my-feature         # Create a new objective
tx status                  # Check all objectives
tx next                    # Advance to the next pipeline step
```

## The Pipeline

```
research → scope → plan → build → close
```

Five steps. `tx next` advances one step at a time. Each step can be delegated to an external provider or run built-in.

| Step | What happens |
|---|---|
| **research** | Explore the codebase, gather context |
| **scope** | Capture requirements and constraints |
| **plan** | Break down into tasks, execution planning |
| **build** | Implementation |
| **close** | QA, changelog, ship |

## Commands

```bash
# Lifecycle
tx init                      # Setup .twisted/
tx open <objective>          # Create objective
tx close [objective]         # Final close step
tx next [objective]          # Advance active objective one step
tx resume <objective>        # Resume named objective
tx status [objective]        # Show all or one objective

# Steps
tx research [objective]      # Run research step
tx scope [objective]         # Run scope step
tx plan [objective]          # Run plan step
tx build [objective]         # Run build step

# Sessions
tx pickup [name]             # Start a session
tx handoff [name]            # End a session (prompts for summary)
tx session status|save|list  # Manage sessions

# Artifacts
tx write <type> [obj]        # Write artifact (from stdin)
tx read <type> [obj]         # Read artifact (to stdout)
tx artifacts [obj]           # List artifacts

# Tasks
tx tasks [obj]               # List tasks
tx tasks add <summary>       # Add a task
tx tasks update <id> --done  # Mark task done
tx tasks update <id> --undone  # Unmark task
tx tasks show <id>           # Show task detail

# Notes
tx note <summary>            # Add note (--note|--decide|--defer|--discover|--blocker)
tx notes [obj]               # Query notes

# Config
tx config [section] [sub]    # Show config

# Flags
-a, --agent       # JSON output (for agent use)
-y, --yolo        # Skip confirmations
-o, --objective   # Target a specific objective
-h, --help        # Show help
-v, --version     # Show version
```

## Directory Structure

```
.twisted/
├── settings.json
├── todo/
│   └── {objective}/
│       ├── state.json        # Step, status, progress
│       ├── tasks.json        # Task list
│       ├── notes.json        # Typed notes
│       ├── research/         # Research artifacts
│       ├── scope.md          # Scope artifact
│       ├── plan.md           # Plan artifact
│       └── sessions/
│           ├── active.json   # Active session
│           └── 001-name.md   # Saved session summaries
├── in-progress/
│   └── {objective}/
└── done/
    └── {objective}/
```

## Configuration

Settings live in `.twisted/settings.json`. Three-layer merge:

```
deepMerge(defaults, ...presets, projectSettings)
```

First preset wins. `settings.json` stores only your overrides.

```json
{
  "$schema": "./schemas/settings.schema.json",
  "presets": ["superpowers"],
  "pipeline": {
    "research": { "provider": "skip" }
  }
}
```

### Presets

| Preset | What it overrides |
|---|---|
| `twisted` | twisted-workflow's own artifact format |
| `superpowers` | TDD discipline, code review → Superpowers |
| `minimal` | All delegatable phases → skip |

### Provider Strings

| Format | Example |
|---|---|
| `"built-in"` | twisted-workflow's own implementation |
| `"superpowers:{skill}"` | `"superpowers:requesting-code-review"` |
| `"skip"` | Omit this phase |
| `"ask"` | Ask user each time |

<details>
<summary><strong>Full config reference</strong></summary>

| Key | Default | Description |
|---|---|---|
| `presets` | `[]` | Preset array, first wins on conflict |
| `context_skills` | `[]` | Skills injected at the start of every step |
| `writing.skill` | `"writing-clearly-and-concisely"` | Writing quality skill |
| `pipeline.research.provider` | `"built-in"` | Provider for research step |
| `pipeline.arch_review.provider` | `"skip"` | Provider for architecture review hook |
| `pipeline.code_review.provider` | `"built-in"` | Provider for code review hook |
| `pipeline.qa.provider` | `"skip"` | Provider for QA hook |
| `pipeline.ship.provider` | `"built-in"` | Provider for ship hook |
| `execution.strategy` | `"task-tool"` | Execution strategy |
| `execution.test_requirement` | `"must-pass"` | `must-pass`, `best-effort`, `deferred` |
| `flow.auto_advance` | `true` | Auto-advance between steps |
| `state.use_folders` | `true` | Use folder-based kanban lanes |
| `files.changelog` | `"CHANGELOG.md"` | Changelog path |
| `naming.strategy` | `"prefix"` | Naming strategy for auto-generated names |

</details>

## Agent Use

Every `tx` command with `-a` returns a typed JSON response:

```ts
interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  state?: ObjectiveState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}
```

Agents read `action` to know what to do next:

- `"invoke_skill"` — load the named skill
- `"prompt_user"` — execute the step described in `prompt`
- `"done"` — pipeline complete
- `"confirm"` — display message, run `next_command` to proceed

## JSON Schema

`tx init` adds a `$schema` reference to `settings.json` for editor autocomplete and validation. If editing settings manually:

```json
{
  "$schema": "path/to/schemas/settings.schema.json"
}
```

## Development

TypeScript source in `src/` is the source of truth. The build script extracts functions via the TypeScript compiler API and embeds them in generated SKILL.md files. Generated files (`skills/`, `presets/`, `schemas/`) are committed to git.

```bash
bun install          # install dependencies
bun run build        # generate skills/, presets/, schemas/
bun run build:cli    # compile tx binary to dist/
bun test             # 160 tests across 17 files
```

**Runtime** (`src/`):

| Module | Purpose |
|---|---|
| `src/cli/` | CLI entry point, arg parser, output formatter, filesystem layer |
| `src/config/` | Config resolution, defaults, deepMerge |
| `src/state/` | State machine, step sequencing |
| `src/notes/` | Typed notes (decision, deferral, discovery, blocker) |
| `src/tasks/` | Task CRUD and group assignment |
| `src/session/` | Session lifecycle (pickup/handoff) |
| `src/artifacts/` | Artifact path resolution and listing |
| `src/presets/` | Typed preset definitions |

**Tooling** (`build/`):

| Module | Purpose |
|---|---|
| `build/skills/` | MarkdownDocument builders (2 files) |
| `build/lib/` | TypeScript AST extraction, skill assembly |
| `build/schema/` | JSON Schema generator |
| `build/__tests__/` | 160 tests across 17 files |

## Contributing

Issues and pull requests welcome at [matthewrobb/twisted-workflow](https://github.com/matthewrobb/twisted-workflow).

---

## License

MIT
