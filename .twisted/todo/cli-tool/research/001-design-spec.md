# twisted-workflow CLI Tool — Design Spec

## Overview

Replace the current architecture — where TypeScript functions are extracted
by the build system and embedded as code blocks in generated SKILL.md files
for Claude to interpret at runtime — with a real CLI tool (`tx`) that owns
all logic. Skills become thin wrappers that invoke `tx` and act on structured
output.

## Goals

- **Reduce token cost** — skills shrink from embedded logic to thin wrappers
- **Improve reliability** — deterministic operations execute as code, not LLM interpretation
- **Improve speed** — config resolution, state transitions, file I/O run natively
- **Improve maintainability** — TypeScript runs as TypeScript, not as markdown read by an LLM
- **Standardize handoffs** — session management with structured pickup/handoff lifecycle
- **Capture decisions** — nothing is lost across sessions (deferrals, discoveries, notes)
- **CLI owns all I/O** — agents never read/write objective files directly, everything goes through `tx`

## Architecture

### CLI as the single entry point

The CLI (`tx`) owns all logic and all file I/O for objective data. Claude
becomes a thin consumer that runs `tx <command> -a`, receives structured
JSON, and dispatches on the `action` field. Agents pipe content to `tx`
for writing rather than using filesystem tools directly.

Human mode (no `-a` flag) produces pretty terminal output for developers
using the tool directly. Judgment steps (research, scoping, planning)
produce handoff prompts in human mode rather than attempting interactive
interrogation — companion mode, not standalone mode.

### Output modes

| Flag | Output | Audience |
|------|--------|----------|
| (none) | Pretty-printed terminal output | Human at terminal |
| `-a, --agent` | Structured JSON (`AgentResponse`) | Claude / LLM agent |

### AgentResponse contract

Every `--agent` command returns:

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

type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: AgentAssignment[] }
  | { type: "install_cli"; instructions: string }
```

## Pipeline

Five steps, clean artifact mapping:

```
research → scope → plan → build → close
```

| Step | Artifact | Format | Description |
|------|----------|--------|-------------|
| research | `research/*.md` | Markdown | Codebase exploration, brainstorming |
| scope | `scope.md` | Markdown | Requirements interrogation |
| plan | `plan.md` + `tasks.json` | Markdown + JSON | Architecture reasoning + structured tasks |
| build | code changes | — | Parallel execution, code review |
| close | `changelog.md` entry | Markdown | QA verification, changelog, ship/merge |

### Sub-steps as hooks

`arch_review` and `code_review` are no longer standalone pipeline steps.
They are configurable hooks within their parent steps:

- **arch_review** — runs within `plan` (delegatable provider)
- **code_review** — runs within `build` (delegatable provider)
- **qa** — runs within `close` (delegatable provider)
- **ship** — runs within `close` (delegatable provider)

### Provider routing

Delegatable operations are routed to configured providers. Top-level:
`research`. Hooks within steps: `arch_review` (in plan), `code_review`
(in build), `qa` (in close), `ship` (in close). Provider strings:

- `"built-in"` — CLI handles it
- `"skip"` — skip entirely
- `"ask"` — ask user which provider
- `"superpowers:<skill>"` — delegate to a superpowers skill
- `"gstack:<command>"` — delegate to a gstack command
- `"nimbalyst:<skill>"` — delegate to a nimbalyst skill

## Command Surface

```
tx <command> [args] [flags]

━━━ Lifecycle ━━━
  tx init                                    Setup .twisted/, detect tools, select presets
  tx open <objective>                        Create objective, start at research
  tx close [objective]                       Final step: QA, changelog, ship/merge
  tx next [objective]                        Advance to next step
  tx resume <objective>                      Resume at current step
  tx status [objective]                      Show status (all or one)

━━━ Steps (explicit trigger) ━━━
  tx research [objective]                    Run research step
  tx scope [objective]                       Run scope step
  tx plan [objective]                        Run plan step
  tx build [objective]                       Run build step

━━━ Session ━━━
  tx pickup [name]                           Start session, read previous handoff
  tx handoff [name]                          End session, write handoff
  tx session status [name]                   Show session info
  tx session save [name]                     Save session summary (stdin)
  tx session list                            List all sessions for objective

━━━ Artifacts ━━━
  tx write <type> [objective]                Write artifact content (stdin)
  tx read <type> [objective]                 Read artifact content (stdout)
  tx artifacts [objective]                   List artifacts for objective

  Artifact types:
    research [--number N]                    Research file
    scope                                    Scope document
    plan                                     Plan document
    changelog                                Changelog entry

━━━ Tasks ━━━
  tx tasks [objective]                       List tasks
  tx tasks add <summary> [objective]         Add a task
  tx tasks update <id> [--done] [--group N]  Update task
  tx tasks assign <id> --group <N>           Assign to execution group
  tx tasks show <id>                         Show task detail

━━━ Notes ━━━
  tx note <summary> [objective]              Add a note (default type)
  tx note <summary> --decide [--reason]      Record a decision
  tx note <summary> --defer [--reason]       Record a deferral
  tx note <summary> --discover [--impact]    Record a discovery
  tx note <summary> --blocker                Record a blocker
  tx notes [objective] [--type] [--step]     Query notes

━━━ Config ━━━
  tx config [section] [sub]                  Show/edit configuration

━━━ Global flags ━━━
  -a, --agent                                Structured JSON output
  -y, --yolo                                 Skip confirmations
  -o, --objective <name>                     Target specific objective
  -h, --help                                 Show help
  -v, --version                              Show version
```

## Data Model

All objective data is JSON. The CLI owns all reads and writes. Agents
interact exclusively through `tx` commands — no direct filesystem access
to `.twisted/` contents.

### state.json

Source of truth for pipeline position.

```json
{
  "objective": "cli-tool",
  "status": "todo",
  "step": "research",
  "steps_completed": [],
  "steps_remaining": ["scope", "plan", "build", "close"],
  "group_current": null,
  "groups_total": null,
  "issues_done": 0,
  "issues_total": null,
  "created": "2026-03-31",
  "updated": "2026-03-31T00:00:00.000Z",
  "tools_used": {},
  "notes": null
}
```

### tasks.json

Structured task/issue data. Replaces issues.md.

```json
[
  {
    "id": 1,
    "summary": "Add CLI entry point",
    "type": "feature",
    "area": "cli",
    "file": "src/cli/index.ts",
    "current_state": "No CLI exists",
    "target_state": "Executable entry point with arg parsing",
    "dependencies": [],
    "group": 1,
    "complexity": 3,
    "done": false
  }
]
```

### notes.json

Running log of decisions, deferrals, discoveries, blockers, and general
notes. Queryable by type and step.

```json
[
  {
    "id": 1,
    "type": "decision",
    "step": "research",
    "summary": "Chose big bang migration",
    "reason": "Codebase is small and well-tested",
    "created": "2026-03-31T14:00:00Z"
  },
  {
    "id": 2,
    "type": "deferral",
    "step": "scope",
    "summary": "Interactive TUI for human-driven scoping",
    "reason": "Massive scope increase, companion mode sufficient for v1",
    "created": "2026-03-31T14:30:00Z"
  },
  {
    "id": 3,
    "type": "note",
    "step": "plan",
    "summary": "Consider adding --json alias for --agent",
    "created": "2026-03-31T15:00:00Z"
  }
]
```

Note types: `note` (default), `decision`, `deferral`, `discovery`, `blocker`.

### sessions/active.json

Active session tracking. At most one per objective.

```json
{
  "number": 3,
  "name": "plan-iteration",
  "step_started": "plan",
  "started": "2026-03-31T14:00:00Z",
  "notes_added": [3, 4, 5],
  "artifacts_created": ["plan.md"],
  "steps_advanced": ["scope", "plan"]
}
```

## Session Lifecycle

### Pickup / Handoff

`tx pickup` and `tx handoff` are the primary session commands.

**Pickup:** `tx pickup [name]` starts a session. If a previous session
exists, includes its handoff data in the response so the new session
has full context. Auto-started by `tx next -a` if no session is active.

**Handoff:** `tx handoff [name]` returns structured session data. The
agent pipes a markdown summary to `tx session save [name]`. The CLI
saves it as `sessions/NNN-name.md` and deletes `active.json`.

**Crash recovery:** If a session is never closed, the next `tx pickup`
or `tx resume` finds `active.json` and includes it in the response.
The new session can continue or close it first.

## Artifact Placement

The CLI owns all artifact paths. Agents pipe content to `tx write` and
read content via `tx read`. No agent-chosen file locations.

```bash
# Agent writes scope document
echo "scope content..." | tx write scope -a

# Agent reads the plan
tx read plan -a

# Agent writes research finding
echo "findings..." | tx write research --number 2 -a

# Target a specific objective
echo "content..." | tx write scope -o my-feature -a
```

External tool outputs (brainstorming specs, superpowers plans) are copied
into the objective directory by the CLI so all artifacts for an objective
live in one place.

## File Layout

```
.twisted/
├── settings.json
├── worktrees/                         (gitignored)
├── todo/
│   └── <objective>/
│       ├── state.json
│       ├── tasks.json
│       ├── notes.json
│       ├── sessions/
│       │   ├── active.json            (at most one)
│       │   ├── 001-research.md        (closed, LLM-written)
│       │   └── 002-scope.md
│       ├── research/
│       │   ├── 001.md
│       │   └── 002.md
│       ├── scope.md
│       └── plan.md
├── in-progress/
└── done/
```

## Package & Distribution

```json
{
  "name": "twisted-workflow",
  "version": "3.0.0",
  "type": "module",
  "bin": {
    "tx": "./dist/cli.js"
  },
  "files": ["dist/", "schemas/", "skills/", "presets/"]
}
```

- **Development:** `bun run src/cli/index.ts`
- **Users:** `npx twisted-workflow`, `npm install -g twisted-workflow`
- **Plugin:** checks for `tx` binary, suggests install if missing

Version 3.0.0 — breaking change to skill architecture.

## Project Structure

```
twisted-workflow/
├── src/
│   ├── cli/                  NEW: entry point, arg parser, output formatters
│   │   ├── index.ts          main entry (bin)
│   │   ├── args.ts           argument parsing
│   │   └── output.ts         agent JSON vs human pretty-print
│   ├── config/               unchanged
│   ├── state/                refactored: JSON instead of frontmatter
│   ├── strategies/           unchanged
│   ├── pipeline/             refactored: 5-step pipeline, hooks for sub-steps
│   ├── scope/                unchanged
│   ├── plan/                 renamed from decompose
│   ├── build/                renamed from execute
│   ├── session/              NEW: pickup, handoff, active session tracking
│   ├── notes/                NEW: note/decision/deferral management
│   ├── tasks/                NEW: task CRUD, group assignment
│   ├── artifacts/            NEW: read/write routing, path resolution
│   ├── work/                 refactored: called by CLI entry point
│   └── presets/              updated for new pipeline shape
├── build/                    refactored: extracts CLI signatures, not function bodies
├── skills/                   generated: thin wrappers invoking tx
├── types/                    updated: new output types, simplified state types
├── schemas/                  regenerated
└── ...
```

## Build System

**Keeps:**
- TypeScript compiler API for extraction
- Schema generation for settings.json autocomplete
- Skill file generation (committed output)

**Changes:**
- Extracts command signatures + JSDoc (not full function bodies)
- Generates thin wrapper skills (not embedded-logic skills)
- Adds CLI compilation step (tsc for dist/)

**Removes:**
- Full function body extraction into markdown code blocks

## Skill Output (Generated)

Skills become thin wrappers. Example:

```markdown
---
name: twisted-work
description: Orchestrator for the twisted-workflow pipeline
user_invocable: true
argument_hint: "[command] [args] [--flags]"
---

# /twisted-work

Run `tx <args> -a` and act on the response.

## Commands

(extracted from CLI --help / JSDoc)

## Response Handling

On receiving an AgentResponse:
- status: "ok" → display output, continue
- status: "handoff" → invoke action.skill with action.prompt
- status: "paused" → show action.message, wait for confirmation
- status: "error" → show error, suggest fix

## Installation

If `tx` is not found: `npm install -g twisted-workflow`
```

## Migration Approach

Big bang. The codebase is small (~111KB src/, 223 tests) and well-structured.
Existing `src/` functions become the CLI's internal library. The new `src/cli/`
layer wraps them with argument parsing and output formatting.

1. Add `src/cli/` entry point wrapping existing `src/` functions
2. Refactor pipeline from 8 steps to 5 (research, scope, plan, build, close)
3. Replace state.md frontmatter with state.json
4. Add session management (pickup/handoff)
5. Add notes system (decisions, deferrals, discoveries)
6. Add tasks system (JSON-based, replaces issues.md)
7. Add artifact read/write commands
8. Refactor build system to extract signatures instead of function bodies
9. Generate new thin wrapper skills
10. Update package.json (bin, version 3.0.0)
11. Update all tests
