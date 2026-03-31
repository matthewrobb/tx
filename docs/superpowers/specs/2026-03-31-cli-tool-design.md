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
- **Standardize handoffs** — session management with structured open/close lifecycle
- **Capture decisions** — nothing is lost across sessions (deferrals, discoveries, decisions)

## Architecture

### CLI as the single entry point

The CLI (`tx`) owns all logic. Claude becomes a thin consumer that runs
`tx <command> --agent`, receives structured JSON, and dispatches on the
`action` field.

Human mode (no `--agent` flag) produces pretty terminal output for developers
using the tool directly. Judgment steps (research, scoping, decomposition)
produce handoff prompts in human mode rather than attempting interactive
interrogation — companion mode, not standalone mode.

### Output modes

| Flag | Output | Audience |
|------|--------|----------|
| (none) | Pretty-printed terminal output | Human at terminal |
| `--agent` | Structured JSON (`AgentResponse`) | Claude / LLM agent |

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

Five steps, clean 1:1 artifact mapping:

```
research → scope → plan → build → close
```

| Step | Artifact | Description |
|------|----------|-------------|
| research | `research/*.md` | Codebase exploration, brainstorming |
| scope | `scope.md` | Requirements interrogation |
| plan | `plan.md` + `issues.md` | Complexity estimation, issue breakdown, arch review |
| build | code changes + execution log | Parallel execution, code review |
| close | `changelog.md` entry | QA verification, changelog, ship/merge |

### Sub-steps as hooks

`arch_review` and `code_review` are no longer standalone pipeline steps.
They are configurable hooks within their parent steps:

- **arch_review** — runs within `plan` (delegatable provider)
- **code_review** — runs within `build` (delegatable provider)

### Provider routing

Delegatable operations are routed to configured providers. Top-level:
`research`. Hooks within steps: `arch_review` (in plan), `code_review`
(in build), `qa` (in done), `ship` (in done). Provider strings:

- `"built-in"` — CLI handles it
- `"skip"` — skip entirely
- `"ask"` — ask user which provider
- `"superpowers:<skill>"` — delegate to a superpowers skill
- `"gstack:<command>"` — delegate to a gstack command
- `"nimbalyst:<skill>"` — delegate to a nimbalyst skill

## Command Surface

```
tx <command> [args] [flags]

Core:
  tx init                          Setup .twisted/, detect tools, select presets
  tx open <objective>              Create objective, start at research
  tx next [objective]              Advance to next step
  tx resume <objective>            Resume at current step
  tx status [objective]            Show status (all or one)

Steps (explicit trigger):
  tx research                      Run research step
  tx scope                         Run scope step
  tx plan                          Run plan step
  tx build                         Run build step
  tx close                         Run close step (QA, changelog, ship)

Session:
  tx session start                 Start tracking a session
  tx session end                   End session → LLM writes summary
  tx session status                Show active session

Decisions:
  tx decide <summary>              Record a decision   [--reason]
  tx defer <summary>               Record a deferral   [--reason]
  tx discover <summary>            Record a discovery  [--impact]
  tx decisions [--type] [--step]   Query decision log

Config:
  tx config [section] [sub]        Show/edit configuration

Global flags:
  --agent          Structured JSON output
  --yolo           Skip confirmations
  --help           Show help
  --version        Show version
```

## State Management

### Objective state — JSON, not frontmatter

State is stored in `state.json`, not YAML frontmatter in markdown files.

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

### Session lifecycle

Sessions track work across conversation boundaries. At most one active
session per objective.

**Start:** `tx session start` or auto-started by `tx next --agent`.

Creates `sessions/active.json`:

```json
{
  "number": 3,
  "step_started": "plan",
  "opened": "2026-03-31T14:00:00Z",
  "decisions": [],
  "deferrals": [],
  "discoveries": [],
  "blockers": [],
  "artifacts_created": [],
  "steps_advanced": []
}
```

**During:** The CLI appends to `active.json` as decisions are made, steps
advance, and artifacts are created.

**End:** `tx session end --agent` returns a handoff response with the
structured session data. The agent writes a markdown summary using the
session data plus its conversation context. The agent then calls
`tx session save --file <path>` to finalize — the CLI moves the file into
`sessions/NNN-<step>.md` and deletes `active.json`.

**Crash recovery:** If a session is never closed, the next `tx resume`
finds `active.json` and includes it in the response. The new session can
continue or close it first.

### Decisions log

`decisions.json` is an append-only index of all decisions, deferrals, and
discoveries across the objective's lifetime. Queryable by type and step.

```json
{
  "entries": [
    {
      "id": 1,
      "step": "research",
      "type": "decision",
      "summary": "Chose big bang migration",
      "rationale": "Codebase is small and well-tested",
      "created": "2026-03-31T14:00:00Z"
    }
  ]
}
```

Entry types: `decision`, `deferral`, `discovery`, `blocker`.

Session markdown files are the rich source of truth. `decisions.json` is
the queryable index.

## File Layout

```
.twisted/
├── settings.json
├── worktrees/                         (gitignored)
├── todo/
│   └── <objective>/
│       ├── state.json
│       ├── sessions/
│       │   ├── active.json            (at most one)
│       │   ├── 001-research.md        (closed, LLM-written)
│       │   └── 002-scope.md
│       ├── decisions.json
│       ├── research/
│       │   ├── 001.md
│       │   └── 002.md
│       ├── scope.md
│       ├── plan.md
│       └── issues.md
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
│   │   ├── output.ts         agent JSON vs human pretty-print
│   │   └── detect.ts         CLI detection for plugin
│   ├── config/               unchanged
│   ├── state/                refactored: JSON instead of frontmatter
│   ├── strategies/           unchanged
│   ├── pipeline/             refactored: 5-step pipeline, hooks for sub-steps
│   ├── scope/                unchanged
│   ├── decompose/            renamed internally to plan
│   ├── execute/              renamed internally to build
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

Run `tx <args> --agent` and act on the response.

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
4. Add session and decisions management
5. Refactor build system to extract signatures instead of function bodies
6. Generate new thin wrapper skills
7. Update package.json (bin, version 3.0.0)
8. Update all tests
