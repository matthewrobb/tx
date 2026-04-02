# twisted-workflow

Artifact-driven orchestration for agentic development with Claude Code — 6-lane epic lifecycle, XState engine, story tier, and session-independent state.

## How It Works

Claude Code sessions end. Context resets. Work disappears.

twisted-workflow stores every epic in a `.twisted/` directory organized as a 6-lane kanban board. Each epic carries its own state, tasks, stories, notes, estimates, and session history as JSON files. Start a session with `tx pickup`, work, end it with `tx handoff` — the next session picks up exactly where you left off.

The v4 engine is **artifact-driven**: each step declares what files it produces and what predicates must pass before it completes. `tx next` evaluates those conditions and advances automatically.

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

Epics move through **lanes** based on their type. The default sequence for a `feature`:

```
0-backlog → 1-ready → 2-active → 4-done
```

Within `2-active`, steps advance based on artifact satisfaction:

```
research → scope → plan → decompose → build
```

`tx next` evaluates which step is active and what's missing. Write artifacts, mark tasks done — `tx next` picks up the rest.

### Lane Reference

| Lane | Dir | Purpose |
|---|---|---|
| Backlog | `0-backlog` | New epics land here |
| Ready | `1-ready` | Estimated and ready to start |
| Active | `2-active` | In development |
| Review | `3-review` | Under review (release type) |
| Done | `4-done` | Completed |
| Archive | `5-archive` | Abandoned or superseded |

### Step Reference (2-active)

| Step | Produces | Exit condition |
|---|---|---|
| `research` | `research/research.md` | File exists |
| `scope` | `scope.md` | File exists |
| `plan` | `plan.md` | File exists |
| `decompose` | `stories.json` | File exists |
| `build` | — | All tasks done |

## Commands

```bash
# Lifecycle
tx init                          # Setup .twisted/ and .claude/agents/
tx open <epic> [--type <type>]   # Create epic (default type: feature)
tx ready <epic>                  # Move from 0-backlog to 1-ready
tx next [epic]                   # Advance active epic one step
tx close [epic]                  # Final close step (QA + changelog + ship)
tx resume <epic>                 # Resume named epic at current step
tx status [epic]                 # Show all epics or detail for one
tx archive <epic> [--reason]     # Move to 5-archive

# Steps
tx research [epic]               # Run research step
tx scope [epic]                  # Run scope step
tx plan [epic]                   # Run plan step
tx build [epic]                  # Run build step

# Estimation & Promotion
tx estimate <epic> --size <XS|S|M|L|XL> --rationale <text> [--timebox <P2D>]
tx promote <epic> --type <feature|bug|chore|release>  # Promote spike

# Stories
tx stories <epic>                # List stories
tx stories <epic> add <summary>  # Add a story
tx stories <epic> done <S-001>   # Mark story done
tx stories <epic> show <S-001>   # Show story detail

# Backlog
tx backlog                       # List backlog candidates from retros
tx backlog promote <BC-001>      # Promote a retro candidate

# Sessions
tx pickup [name]                 # Start a session
tx handoff [name]                # End session (prompts for summary)
tx session status|save|list      # Manage sessions

# Artifacts
tx write <type> [epic]           # Write artifact (from stdin)
tx read <type> [epic]            # Read artifact (to stdout)
tx artifacts [epic]              # List artifacts

# Tasks
tx tasks [epic]                  # List tasks
tx tasks add <summary>           # Add a task
tx tasks update <id> --done      # Mark task done
tx tasks show <id>               # Show task detail

# Notes
tx note <summary>                # Add note (--decide|--defer|--discover|--blocker)
tx notes [epic]                  # Query notes

# Config
tx config [section] [sub]        # Show config

# Flags
-a, --agent       # JSON output (for agent use)
-y, --yolo        # Skip confirmations
-e, --epic        # Target a specific epic
-h, --help        # Show help
-v, --version     # Show version
```

### Epic Types

| Type | Lane sequence |
|---|---|
| `feature` | backlog → ready → active → done |
| `bug` | backlog → active → done |
| `spike` | backlog → active → done (promotable via `tx promote`) |
| `chore` | backlog → active → done |
| `release` | backlog → ready → active → review → done |

## Directory Structure

```
.twisted/
├── settings.json
├── 0-backlog/
│   └── {epic}/
├── 1-ready/
│   └── {epic}/
│       └── estimate.json         # Size, confidence, rationale
├── 2-active/
│   └── {epic}/
│       ├── state.json            # Lane, step, status, progress
│       ├── tasks.json            # Task list
│       ├── stories.json          # Story list (from decompose step)
│       ├── notes.json            # Typed notes
│       ├── research/
│       │   └── research.md       # Research artifact
│       ├── scope.md              # Scope artifact
│       ├── plan.md               # Plan artifact
│       └── sessions/
│           ├── active.json       # Active session
│           └── 001-name.md       # Saved session summaries
├── 3-review/
├── 4-done/
│   └── {epic}/
│       ├── retro.md              # Retrospective (generated at close)
│       └── backlog-candidates.json
└── 5-archive/

.claude/
└── agents/
    └── {epic} → symlink to epic's lane dir
```

## Configuration

Settings live in `.twisted/settings.json`. Two-layer merge:

```
deepMerge(defaults, projectSettings)
```

`settings.json` stores only your overrides — all fields optional.

```json
{
  "$schema": "./schemas/settings.schema.json",
  "context_skills": ["/my-project-nav"]
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

TypeScript source in `src/` is the source of truth. The build script generates the SKILL.md and JSON Schema from source. Generated files (`skills/`, `schemas/`) are committed to git.

```bash
npm install          # install dependencies
npm run build        # generate skills/, schemas/
npm run build:cli    # compile tx binary to dist/
npm test             # 109 tests across 14 files
```

**Runtime** (`src/`):

| Module | Purpose |
|---|---|
| `src/cli/` | CLI (commander), command modules, filesystem layer |
| `src/types/` | All type definitions with barrel export |
| `src/config/` | Config resolution, defaults (6 lanes), deepMerge |
| `src/engine/` | Artifact evaluator, predicate engine, XState v5 machine, `txNext()` |
| `src/daemon/` | On-demand daemon server/client (sock-daemon) |
| `src/stories/` | Story CRUD (epic → story → task hierarchy) |
| `src/agents/` | Agent symlink generation (.claude/agents/) |

**Tooling** (`build/`):

| Module | Purpose |
|---|---|
| `build/skills/` | Skill content builders |
| `build/lib/` | TypeScript AST extraction, skill assembly |
| `build/schema/` | JSON Schema generator |
| `build/__tests__/` | 175 tests across 20 files |

## Contributing

Issues and pull requests welcome at [matthewrobb/twisted-workflow](https://github.com/matthewrobb/twisted-workflow).

---

## License

MIT
