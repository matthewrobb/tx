# Scope: twisted-workflow v4 — Data-Driven Workflow Engine

## Overview

Full rewrite of twisted-workflow as a **data-driven workflow engine** for building
with Claude Code. The engine becomes workflow-agnostic: phases, steps, artifacts,
transitions, issue types, and conditions are all defined in configuration, not code.
The simplest valid workflow is one step. The most complex is an arbitrary DAG with
expression-based guards, persona-driven agents, and skill-based automation.

This is a **complete cutover** — no backwards compatibility, no migration from the
current codebase. The existing code is reference material only. Stays within v4
versioning (v4 has not shipped).

## Core Concepts

### Vocabulary

| Concept | Term | Description |
|---------|------|-------------|
| Backlog items (recursive) | **issue** | Any unit of work — small bug to large epic. Issues contain child issues. |
| Focused working period | **cycle** | Pulls issues from backlog. One active at a time. Has a workflow. Ephemeral. |
| Lifecycle stage | **phase** | Mapped to a phase category the engine reasons about. |
| Phase archetypes | **phase category** | ~4 types: backlog, active, done, canceled. Engine primitives. |
| Work within a phase | **step** | Unit of work in a workflow. Declares needs, produces, when conditions. |
| Step dependencies | **needs** | DAG edges — steps declare predecessors, engine resolves order. |
| Produced files/data | **artifact** | Named outputs from steps — markdown files or structured data. |
| Conditions | **when** | Expression-based guards: `done`, `skip`, `block`. |
| Collected responses | **vars** | Durable prompt responses stored on the issue/cycle. |
| Agent perspective | **persona** | Defines WHO does the work — security, performance, etc. |
| Reusable instructions | **skill** | Defines HOW to do the work — methodology, process. |
| Step outputs | **produces** | Declared artifacts a step creates. |
| Entry conditions | **requires** | What must exist before a step can begin. |
| The process definition | **workflow** | DAG of steps with conditions, assigned to cycles. |
| Context snapshots | **checkpoint** | Handoff/pickup context bridges between LLM sessions. |
| Lifecycle rules | **automation** | Event-condition-action triples. |

### Two-Level Model: Issues + Cycles

**Issues** are the work. They live in a backlog, are recursive (issues contain child
issues), and can accumulate pre-work (research, notes) outside of any cycle. Small
issues get pulled directly into a cycle. Large issues (epic-like) stay in the backlog
while their children get pulled into cycles over time. A parent issue is done when
all its children are done.

**Issues can have their own workflow.** An issue's type (from `issue_types` config)
determines its default workflow. You can work an issue through its workflow without
ever creating a cycle — just `tx next <issue>`. Cycles are optional overhead for
batching multiple issues into a focused sprint. Single-issue work doesn't need it.

**Cycles** are the optional focus container. You start a cycle, pull issues in, and
work through a cycle-level workflow. One active cycle at a time. The cycle has a
workflow that drives through steps (research, scope, plan, build, etc.). When the
cycle closes, a retro and checkpoint are produced.

When you pull issues into a cycle, you can pull a subset of a parent issue's children.
What stays behind remains in the backlog. What gets pulled is adopted by the cycle.
The cycle's workflow checks what pre-work already exists on pulled issues and skips
steps accordingly.

### Deferrals as Issues

When an agent defers work during a cycle or while working an issue, the deferral
creates a **new sibling issue** in the backlog — not just a note. This makes deferred
work automatically trackable and pullable into future cycles.

A deferral produces:
1. A new issue in the backlog (sibling or child, contextual)
2. A deferral note on the current issue linking to the new one
3. Traceability metadata: `deferred_from: { issue, step, cycle }`

The retro at cycle close aggregates all deferrals: "N issues were deferred during
this cycle" with links to each. Deferred issues appear in `open/` as real backlog
items, not buried in notes.

### Policies

Configurable rules that govern agent behavior for deferrals, decisions, and other
actions that affect scope or direction:

```json
{
  "policies": {
    "deferral": "require_approval",
    "decision": "require_approval",
    "scope_change": "block",
    "issue_create": "allow"
  }
}
```

| Policy | `allow` | `require_approval` | `block` |
|--------|---------|-------------------|---------|
| `deferral` | Agent defers freely | Agent proposes, prompter approves | Agent cannot defer — must complete or escalate |
| `decision` | Agent decides freely | Agent proposes, prompter decides | Agent cannot make decisions — always escalates |
| `scope_change` | Agent can modify scope | Agent proposes changes, prompter approves | No scope changes allowed |
| `issue_create` | Agent creates issues freely | Agent proposes, prompter approves | Agent cannot create issues |

Policies are expressions too — they can be conditional:

```json
{
  "policies": {
    "deferral": "if(cycle.step == 'build', 'require_approval', 'allow')",
    "decision": "if(data.estimate.size == 'XL', 'require_approval', 'allow')"
  }
}
```

When a policy is `require_approval`, the daemon pauses and returns a `prompt_user`
action. The prompter approves or rejects. The result is stored in the action log.

Policies can be set globally, per-workflow, or per-step — most specific wins.

### Workflow as a DAG

Steps declare `needs` (predecessor steps), not a fixed sequence. The engine resolves
execution order from the graph. Parallel steps are natural — if two steps don't depend
on each other, they can run concurrently.

```json
{
  "steps": {
    "research": { "produces": ["research.md"], "when": { "done": "artifacts.research.exists" } },
    "scope": { "needs": ["research"], "produces": ["scope.md"] },
    "estimate": { "needs": ["scope"], "produces": ["estimate"] },
    "plan": { "needs": ["estimate"], "produces": ["plan.md"] },
    "decompose": { "needs": ["plan"], "produces": ["issues"] },
    "build": { "needs": ["decompose"], "when": { "done": "issues.all_done" } },
    "close": { "needs": ["build"], "produces": ["retro.md"] }
  }
}
```

### Expression System

All conditions are expressions evaluated against a typed context. The engine never
reads from the filesystem — all evaluation is against DB state.

**Context namespaces:**

| Namespace | Source | Examples |
|-----------|--------|----------|
| `artifacts` | Artifact records in DB | `artifacts.research.exists`, `artifacts.scope.hash` |
| `issue` | Current issue fields | `issue.type`, `issue.phase`, `issue.status` |
| `issues` | Child issue aggregates | `issues.count`, `issues.done_count`, `issues.all_done`, `issues.progress` |
| `data` | Issue/cycle JSONB data | `data.estimate.exists`, `data.estimate.size` |
| `vars` | Collected prompt responses | `vars.skip_research`, `vars.focus_area` |
| `cycle` | Active cycle state | `cycle.step`, `cycle.ideas`, `cycle.workflow` |
| `step` | Current step metadata | `step.name`, `step.phase` |
| `workflow` | Workflow definition | `workflow.name` |
| `env` | System context | `env.date`, `env.user` |

**Built-in functions:**

| Function | Returns | Purpose |
|----------|---------|---------|
| `confirm(message)` | boolean | Yes/no from prompter |
| `prompt(message)` | `{ answered, value }` | Free-text from prompter |
| `choose(message, options[])` | string | Selection from prompter |
| `all(collection, expr)` | boolean | Every item matches |
| `any(collection, expr)` | boolean | At least one matches |
| `count(collection)` | number | Collection size |
| `issue(name)` | issue context | Cross-issue reference (stretch) |

Prompt responses are stored durably as `vars` in the DB — they persist across
daemon restarts and session changes.

**Vars declaration on steps:**

```json
{
  "research": {
    "vars": {
      "skip": { "confirm": "Skip research for this issue?", "if": "issue.type == 'bug'" },
      "focus": { "prompt": "What should research focus on?", "if": "!vars.skip" }
    },
    "when": {
      "skip": "vars.skip == true",
      "done": "artifacts.research.exists"
    }
  }
}
```

### Phase Categories (from Linear)

The engine reasons about ~4 categories. Users name phases anything they want:

```json
{
  "phases": {
    "icebox": { "category": "backlog" },
    "ready": { "category": "backlog" },
    "building": { "category": "active" },
    "shipped": { "category": "done" },
    "wont-fix": { "category": "canceled" }
  }
}
```

Filesystem folders map to a simplified view, not to individual phase names.

## Architecture

### Three-Layer Split

```
Engine (generic, workflow-agnostic):
  - Workflow schema parser + validator
  - Machine generator (workflow definition -> XState at load time)
  - Expression evaluator (against DB context)
  - State manager (PGLite + machine transitions)
  - Projection sync (DB -> filesystem markdown)

Vocabulary (data, not code):
  - .twisted.json (phases, steps, conditions, issue types, skills, personas)
  - Built-in expressions
  - Skills and personas (npm packages)

CLI (thin socket client):
  - Serialize request -> send to daemon -> print response
```

### Ports & Adapters

Abstract concrete tech choices behind interfaces:

| Port | Default Adapter | Purpose |
|------|----------------|---------|
| `StoragePort` | PGLiteAdapter | Persistence — queries, transactions |
| `TransportPort` | SocketAdapter | Daemon communication |
| `ProjectionPort` | MarkdownAdapter | DB -> filesystem rendering |
| `PackageResolverPort` | NpmAdapter | Skill/persona installation |
| `ExpressionEvaluatorPort` | BuiltInEvaluator | Condition evaluation |

Tests inject in-memory adapters. Future service mode uses HttpAdapter for transport.

### Storage: PGLite

Embedded Postgres via WASM. Canonical state authority.

- **JSONB** for machine snapshots, vars, issue data, notes — queryable, partially updatable
- **No native compilation** — pure WASM, npm install and done
- **ACID transactions** — atomic state changes
- **Postgres compatible** — queries migrate to a real Postgres if ever needed
- **Owned exclusively by the daemon** — single writer, no contention

The engine never reads from the filesystem. All expression evaluation, state queries,
and condition checks go against the DB.

### Daemon: The One Path

Every `tx` command goes through the daemon. No direct mode, no fallback.

```
tx <anything>
  -> daemon running? -> send request via socket
  -> not running? -> spawn daemon -> send request
```

**What the daemon owns:**
- PGLite connection (single writer)
- Request queue (concurrent sub-agents serialized)
- Machine state in memory (rehydrate once on startup)
- Dirty tracking (which issues/cycles changed since last flush)
- Flush logic (batched on queue idle)

**Flush strategy:**
- DB writes are immediate (every mutation durable on commit)
- Snapshot + markdown projection batched — flush when queue drains
- On graceful shutdown: final flush if dirty
- During burst activity: DB stays current, filesystem not thrashed

**Recovery:**
1. DB exists -> use it (authoritative)
2. DB missing -> seed from snapshot.json
3. Both missing -> fresh init

### State Machine (XState)

Machine definition is **generated from the workflow config at load time**, not
hand-coded. Every workflow gets its own machine.

- Functional model (expression evaluator) = **sensor layer** (reads DB, produces events)
- Machine = **decision layer** (governs which transitions are legal)
- **Deterministic by construction** — same state + event = same result

```
Expression evaluator (reads DB state)
  -> Events (what conditions are met)
    -> Machine (is this transition legal?)
      -> PGLite transaction (persist snapshot + state)
        -> Flush when idle (snapshot.json + markdown projection)
```

### Config Validation (Branded ValidConfig)

`resolveConfig()` returns a validated config or throws with structured errors.
Branded `ValidConfig` type — downstream code cannot accept unvalidated config.

Validates:
- Phase categories exist for all phases
- Step `needs` form a valid DAG (no cycles)
- Expression syntax parses correctly
- Skill and persona references resolve from manifest
- Workflow definitions are internally consistent

## File Layout

### In-Project (committed)

```
my-project/
├── .twisted.json                        <- config entry point
└── .twisted/
    ├── open/                            <- open issues
    │   ├── rewrite-auth/
    │   │   ├── issue.md                 <- rendered summary
    │   │   ├── research.md              <- pre-cycle artifact
    │   │   ├── implement-rotation/
    │   │   │   └── issue.md
    │   │   └── migrate-users/
    │   │       └── issue.md
    │   ├── add-billing/
    │   │   └── issue.md
    │   └── new-dashboard/
    │       └── issue.md
    │
    ├── active/                          <- current cycle
    │   ├── cycle.md                     <- rendered: pulled issues, step, progress
    │   ├── scope.md                     <- cycle-level artifacts
    │   └── plan.md
    │
    ├── closed/
    │   ├── issues/                      <- completed issues (with children)
    │   │   └── fix-token-bug/
    │   │       └── issue.md
    │   └── cycles/                      <- completed cycles (slug from name/content)
    │       ├── auth-and-bugfixes/
    │       │   ├── cycle.md
    │       │   └── retro.md
    │       └── initial-setup/
    │
    ├── checkpoints/                     <- context bridges between LLM sessions
    │   ├── 001.md
    │   └── 002.md
    │
    └── snapshot.json                    <- full DB state dump (recovery + sharing)
```

### Out-of-Project (user-local)

```
~/.twisted/                              <- user root (configurable)
├── config.json                          <- global user preferences
└── projects/
    └── {project-id}/
        ├── twisted.db                   <- PGLite database
        ├── package.json                 <- skill/persona dependencies
        ├── node_modules/                <- installed packages
        ├── skills.lock                  <- pinned versions
        └── skill-manifest.json          <- discovered skills/personas cache
```

Configurable via `data_dir` in `.twisted.json`. Default is `~/.twisted/projects/{id}/`.

### What Goes Where

| Location | Contains | Committed? |
|----------|----------|-----------|
| `.twisted.json` | Config, workflows, dependencies, extends | Yes |
| `.twisted/open/` | Open issues (projected markdown) | Yes |
| `.twisted/active/` | Current cycle (projected markdown + artifacts) | Yes |
| `.twisted/closed/` | Completed issues and cycles | Yes |
| `.twisted/checkpoints/` | LLM session context bridges | Yes |
| `.twisted/snapshot.json` | Full DB state dump | Yes |
| `~/.twisted/projects/{id}/` | DB, installed packages, manifest, lock | No |

**Principle:** If it's in the project, you should commit it. Everything else is in the user directory.

## Configuration

### Entry Point

`.twisted.json` in project root (OR `.twisted/settings.json` — first found wins):

```json
{
  "$schema": "https://twisted-workflow.dev/schemas/config.schema.json",
  "extends": "@company/twisted-config",
  "data_dir": "~/.twisted/projects/my-project",

  "phase_categories": ["backlog", "active", "done", "canceled"],

  "phases": {
    "backlog": { "category": "backlog" },
    "active": { "category": "active" },
    "done": { "category": "done" }
  },

  "issue_types": {
    "feature": { "workflow": "full" },
    "spike": { "workflow": "lightweight" },
    "bug": { "workflow": "triage" }
  },

  "workflows": {
    "full": {
      "steps": {
        "research": {
          "phase": "backlog",
          "skill": "@mattpocock/improve-codebase-architecture",
          "produces": ["research.md"],
          "when": {
            "skip": "cycle.issues.all(i => i.artifacts.research.exists)",
            "done": "artifacts.research.exists"
          }
        },
        "scope": {
          "phase": "backlog",
          "needs": ["research"],
          "skill": "@mattpocock/write-a-prd",
          "produces": ["scope.md"],
          "when": { "done": "artifacts.scope.exists" }
        },
        "estimate": {
          "phase": "backlog",
          "needs": ["scope"],
          "skill": "twisted/adversarial-estimate",
          "personas": ["security", "performance", "optimist", "pessimist"],
          "produces": ["estimate"],
          "when": { "done": "data.estimate.exists" }
        },
        "plan": {
          "phase": "backlog",
          "needs": ["estimate"],
          "skill": "@mattpocock/prd-to-plan",
          "produces": ["plan.md"],
          "when": { "done": "artifacts.plan.exists" }
        },
        "decompose": {
          "phase": "backlog",
          "needs": ["plan"],
          "produces": ["issues"],
          "when": { "done": "issues.count > 0" }
        },
        "build": {
          "phase": "active",
          "needs": ["decompose"],
          "when": { "done": "issues.all_done" }
        },
        "close": {
          "phase": "done",
          "needs": ["build"],
          "produces": ["retro.md"]
        }
      }
    },
    "lightweight": {
      "steps": {
        "research": {
          "phase": "backlog",
          "produces": ["research.md"],
          "when": { "done": "artifacts.research.exists" }
        },
        "scope": {
          "phase": "backlog",
          "needs": ["research"],
          "produces": ["scope.md"],
          "when": { "done": "artifacts.scope.exists" }
        },
        "close": {
          "phase": "done",
          "needs": ["scope"]
        }
      }
    },
    "minimal": {
      "steps": {
        "do": {
          "phase": "active",
          "when": { "done": "confirm('Mark as done?')" }
        },
        "close": {
          "phase": "done",
          "needs": ["do"]
        }
      }
    }
  },

  "personas": {
    "security": {
      "description": "Security-focused reviewer",
      "instructions": "Evaluate from a security perspective..."
    },
    "performance": {
      "description": "Performance-focused reviewer",
      "instructions": "Evaluate from a performance perspective..."
    }
  },

  "automations": [
    { "on": "step.when.done.satisfied", "then": "advance" },
    { "on": "cycle.closed", "after": "30d", "then": "archive" }
  ],

  "dependencies": {
    "@mattpocock/skills": "^1.0.0",
    "@twisted/personas-engineering": "^1.0.0",
    "@company/twisted-config": "^3.0.0"
  }
}
```

### Extends (like tsconfig)

- `"extends": "@company/twisted-config"` — npm package or relative path
- Deep merge local overrides on top
- Chains: extended config can itself extend
- Enables team presets, framework starters, community configs

### Schemas for Everything

| Schema | Validates |
|--------|-----------|
| `config.schema.json` | `.twisted.json` |
| `snapshot.schema.json` | `.twisted/snapshot.json` |
| `issue.schema.json` | Issue data structure |
| `workflow.schema.json` | Workflow definitions (standalone) |
| `protocol.schema.json` | Daemon request/response messages |
| `skill-manifest.schema.json` | Discovered skill/persona metadata |

Generated from TypeScript types at build time.

## Skills & Personas

### Installation via npm

Skills and personas are npm packages installed in `~/.twisted/projects/{id}/node_modules/`.

```bash
tx install                           # install all from config dependencies
tx install @mattpocock/skills        # add specific + install
```

`tx install` is idempotent — run it to install, run it again to update. If a skill
reference can't be resolved from the manifest at runtime, the daemon returns an error
with instructions to run `tx install`.

### Skill Discovery and Manifest

On install, an agent explores the package, discovers skills/personas, and builds a
cached manifest:

```json
{
  "@mattpocock/skills": {
    "version": "1.2.0",
    "discovered": "2026-04-02T20:00:00Z",
    "skills": {
      "improve-codebase-architecture": {
        "path": "improve-codebase-architecture/SKILL.md",
        "description": "...",
        "detected_outputs": ["github-issue"],
        "suggested_overrides": {
          "omit": ["Step 7"],
          "output": {
            "directive": "Write findings as artifact via tx write. Do NOT create GitHub issues.",
            "target": "research.md"
          }
        }
      }
    }
  }
}
```

Re-discovery only triggers when the package version changes. The manifest is the
cache — the daemon reads it to resolve skill references without re-exploring packages.

### Output Contracts (Three-Layer Merge)

Skills may have output instructions that conflict with the workflow (e.g., "create a
GitHub issue" when the workflow expects an artifact). Resolution is a three-layer merge:

```
1. Skill content (SKILL.md from node_modules)
2. + Manifest overrides (auto-derived on install, in user dir)    <- smart defaults
3. + Config overrides (in .twisted.json, user-written)            <- explicit wins
```

Manifest stores auto-derived overrides. Config only has what the user explicitly
customizes. At runtime, all three are merged to construct the skill invocation prompt.

```bash
tx skill show <name> --overrides     # see full merged result
tx skill inline <name>               # copy manifest overrides into config
```

### Personas

Personas define agent perspective/expertise. Distinct from skills (what to do vs who
does it). A step can combine a skill with one or more personas:

```json
{
  "estimate": {
    "skill": "twisted/adversarial-estimate",
    "personas": ["security", "performance", "optimist", "pessimist"]
  }
}
```

Personas are packageable as npm dependencies, resolved from the manifest like skills.

### Guided Setup

`tx init` is a conversational flow — the agent asks about work style, recommends
workflow templates and skill/persona packages, and generates `.twisted.json`.

The agent can search for skill suggestions from:
- npm registry
- GitHub (repos with SKILL.md / persona definitions)
- Installed Claude Code plugins

## Commit Templates

`tx commit` (or a commit automation) generates structured commit messages from
DB state:

```
feat(fix-auth): implement token rotation [S-003]

Issue: fix-auth
Step: build
Cycle: auth-and-bugfixes
Story: S-003
Checkpoint: 003
```

Optimized for reverse lookup — from any commit, trace back to issue, cycle, step,
and checkpoint. Structured trailers enable `git log --grep` queries.

The daemon can write commit hashes back to issue data in the DB for forward lookup.

## Checkpoints (Handoff/Pickup)

Checkpoints are project-level context snapshots for the human + primary Claude Code
agent. They bridge LLM sessions — when you start a new conversation, the last
checkpoint gives the agent everything it needs.

```bash
tx handoff                  # agent summarizes + asks for handoff notes -> writes checkpoint
tx pickup                   # loads most recent checkpoint into context
tx pickup --brief           # one-paragraph summary
tx pickup --list            # show recent, pick one
```

Checkpoints are NOT per-issue. They capture cross-issue working context: what was
worked on, decisions made, where things stand, what to pick up next. They reference
issues touched but aren't stored under any single issue.

Stored in DB and projected to `.twisted/checkpoints/{n}.md` (committed).

`tx resume <issue>` is separate — it loads a specific issue's workflow state, not
the session context.

## Workflow Migration

When users change workflow definitions, existing data needs to migrate.

**Data model minimizes migration needs:** Phase and step are string fields, not foreign
keys. Most changes are cheap:

| Change | Migration |
|--------|-----------|
| Add a step | None — existing cycles past that point unaffected |
| Remove a step | Cycles currently on that step need reassignment |
| Rename a step | `UPDATE SET step = 'new' WHERE step = 'old'` |
| Rename a phase | `UPDATE SET phase = 'new' WHERE phase = 'old'` |
| Reorder DAG | None — cycles track current step, not position |
| Change `when` conditions | None — evaluated live |

For simple renames: automatic. For structural changes: agent-aided via `tx migrate`.

Workflow versioning in config supports declarative migration rules:

```json
{
  "workflows": {
    "full": {
      "version": 2,
      "migrations": {
        "1->2": {
          "steps": { "decompose": "build" },
          "phases": { "review": "active" }
        }
      }
    }
  }
}
```

## Service Mode (Future)

With the TransportPort abstraction, the daemon can expose HTTP alongside the socket:

```typescript
const daemon = createDaemon({
  transport: new MultiTransport([
    new SocketAdapter(socketPath),
    new HttpAdapter({ port: 3000 }),
  ]),
});
```

Enables web dashboards, external integrations, and team visibility. Not in scope
for the initial rewrite but the architecture supports it from day one.

## CLI Commands

```bash
# Issues
tx issue "fix auth" [--type bug]           # create issue in backlog
tx issue "research" --parent rewrite-auth  # create child issue
tx issue defer "rate limiting" [--from S-003]  # create deferred sibling issue
tx issues                                  # list open issues

# Working an issue directly (no cycle)
tx next <issue>                            # advance issue's own workflow
tx step [name] --issue <issue>             # run a specific step on an issue
tx close <issue>                           # close an issue

# Cycles (optional batching)
tx cycle [name]                            # start new cycle
tx pull <issue-slug>                       # pull issue into active cycle
tx next                                    # advance cycle workflow
tx close                                   # end cycle (retro + checkpoint)

# Within a cycle
tx issue add "summary"                     # add decomposed issue
tx issue done <id>                         # mark done

# Steps (auto-generated from workflow)
tx step [name]                             # run/resume a step
tx write <artifact>                        # write artifact content
tx read <artifact>                         # read artifact content

# Dependencies
tx install [package]                       # install/add skill or persona package
tx skill show <name> [--overrides]         # inspect a skill

# Context
tx handoff                                 # create checkpoint
tx pickup [--brief|--list]                 # load checkpoint
tx resume <issue>                          # load issue workflow state
tx note "summary" [--type]                 # add a note

# Setup
tx init                                    # guided setup (conversational)
tx migrate                                 # agent-aided workflow migration

# Config
tx config                                  # show resolved config
tx status [issue|cycle]                    # show state
```

## What's NOT in Scope

- Web UI / dashboard (service mode enables later)
- Velocity / burndown tracking
- Sprint grouping / time-boxing
- Cross-issue dependency expressions (`issue('name')` in expressions)
- Multi-skill composition (`skill_chain`, `skill_parallel`)
- Ralph integration
- npm publish / CI pipeline
- Git hook generation

These are enabled by the architecture but not built in this rewrite.
