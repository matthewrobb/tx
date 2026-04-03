# twisted-workflow — Technical Design

## Why This Exists

Software development with AI agents breaks the way we've always worked.

Traditional process assumes a human holds context across days and weeks. You open
a ticket, research the problem, write a plan, build the thing, review it, ship it.
The human is the continuity. The process is just ceremony around that continuity —
stand-ups to sync humans, sprints to batch human attention, Jira boards to track
what humans are doing.

AI agents don't work that way. A Claude Code session lasts minutes to hours, not
days. Context resets completely between sessions. The agent has no memory of what
it did yesterday. It can't pick up where it left off unless someone — or something
— tells it where "off" was.

The naive response is waterfall: write a massive spec up front, hand it to the
agent, pray. This fails for the same reason waterfall always fails — you don't
know enough at the start to specify everything, and the act of building reveals
what the spec got wrong. But with agents, it fails even harder: the agent can't
course-correct mid-flight because it can't perceive the drift. It follows the
spec literally, and the spec was wrong.

What actually works is what's always worked: small steps, fast feedback, adaptive
planning. Research before you scope. Scope before you plan. Plan before you build.
Check your work at each boundary. Except now the entity doing the work forgets
everything between steps. So the process itself has to carry the context.

That's what twisted-workflow does. It's the memory and the process in one system.
Each step produces artifacts. Artifacts carry context forward. The next session
reads the artifacts, knows where things stand, and picks up cleanly. The agent
doesn't need memory — the workflow has it.

## The Problems, Specifically

Once you accept that agents need structured process, you hit a cascade of
concrete engineering problems:

**Context loss.** Sessions end. The agent that did the research is gone. The agent
that does the scoping needs to read the research output, not re-derive it. Artifacts
must be durable, discoverable, and self-describing.

**Concurrency.** Multiple agents may work in parallel — decomposing an epic into
stories, then farming stories to sub-agents. If two agents try to update the same
state simultaneously via file writes, you get corruption. You need a single writer
with ACID guarantees.

**Workflow rigidity.** Different kinds of work need different processes. A bug fix
doesn't need a research phase. A spike doesn't need decomposition. Hardcoding the
step sequence means every workflow change is a code change. The process definition
should be data, not code.

**Condition complexity.** "Advance when all tasks are done" is simple. "Skip
research if we already have it from a previous cycle" is not. "Block the build
step until the user confirms the plan" requires interaction. Conditions need to be
expressive, composable, and capable of pausing for human input.

**Skill incompatibility.** The agentic skill ecosystem is evolving fast. New skills
hit GitHub every week — TDD methodologies, PRD writers, code reviewers, triage
workflows, architecture analyzers. Each one produces outputs in its own way:
creating GitHub issues, writing files to arbitrary paths, making git commits,
posting to Slack. A workflow engine can't assume skills will conform to its
conventions. It needs to adapt any skill's outputs into its own pipeline without
requiring the skill author to know the engine exists. And it needs to do this
gracefully as new skills appear and existing ones change, because the landscape
won't hold still long enough to write bespoke adapters for each one.

**Session handoff.** The human starts a session, works with an agent for an hour,
stops. Tomorrow, a fresh agent needs to know: what was done, what's next, what
decisions were made, what was deferred. This isn't just "read the issue state" —
it's a narrative summary that captures working context.

## The Cast

twisted-workflow solves these problems with a small set of interlocking concepts.
Before diving into implementation, here's who they are and how they relate.

### Issues

An **issue** is any unit of work — from a small bug to a large feature. Issues are
the atoms of the system. They have a type (feature, bug, spike, chore), a workflow
that governs their lifecycle, and a current step within that workflow. Issues are
recursive: a feature issue can contain child issues.

Issues accumulate state over time: notes, tasks, vars (collected prompt responses),
and artifacts (step outputs). This state persists across sessions. When an agent
picks up an issue, it reads the accumulated state and knows where things stand.

### Workflows

A **workflow** is a directed acyclic graph (DAG) of steps. Each step declares:
- `needs` — which steps must complete before this one can start
- `produces` — what artifacts this step creates
- `done_when` / `skip_when` / `block_when` — expression-based conditions

The simplest workflow is one step. A feature workflow might be `research → scope →
plan → build`. A complex workflow could have parallel branches: research and
security review happening simultaneously before the plan step.

Workflows are data — defined in configuration, not code. Changing a workflow
doesn't require changing the engine. The engine reads the definition and generates
the execution plan dynamically.

### Steps

A **step** is one unit of work within a workflow. Steps don't execute code — they
define conditions and artifacts. The agent does the actual work. The engine's job
is to evaluate whether a step is done, blocked, ready, or should be skipped.

Steps can have skills attached. When the engine reaches a step, it can return an
`invoke_skill` action telling the agent which skill to use. The skill provides
methodology; the step provides context and constraints.

### Expressions

**Expressions** are the condition language. Instead of hardcoded predicates, every
condition is a string that gets parsed and evaluated against the current context:

```
done_when: "artifacts.all_present"
skip_when: "vars.skip_research == true"
block_when: "not tasks.all_done"
done_when: "confirm('Ready to deploy?')"
```

Expressions access five namespaces: `vars` (user-defined variables), `issue`
(current issue state), `artifacts` (what's been written), `tasks` (completion
state), and `cycle` (active cycle, if any). They support `and`/`or`/`not`,
comparisons, member access with null propagation, and function calls — including
interactive functions that pause evaluation for user input.

### Cycles

A **cycle** is an optional focus container — think "sprint" without the time-boxing
baggage. You start a cycle, pull issues into it, work through them, close with a
retrospective and checkpoint. One active cycle at a time.

Cycles are optional. You can work issues directly without ever creating a cycle.
Small projects might never use them. Larger projects use them to batch related
work and generate retros.

### The Daemon

The **daemon** is the single process that owns all state. Every `tx` command goes
through it. There is no direct mode, no fallback, no "just read the files."

Why? Because of the single-writer problem. PGLite (the embedded database) supports
one connection. Multiple agents writing concurrently would corrupt state. The daemon
serializes all writes through one process. It also batches projection (DB → markdown
file writes) to avoid thrashing the filesystem during burst activity.

The daemon communicates via Unix domain sockets (or Windows named pipes). The
protocol is newline-delimited JSON: one request line, one response line, close.

### PGLite

**PGLite** is embedded Postgres compiled to WebAssembly. It's the canonical state
store — the single source of truth. Every query, every condition check, every
state transition goes through PGLite.

Why Postgres and not SQLite? JSONB. Vars, metadata, and structured data are stored
as JSONB columns — queryable, partially updatable, indexable. SQLite's JSON support
exists but is bolted on; Postgres's is native and battle-tested. PGLite also means
the query language is real Postgres SQL — if the project ever needs to scale to a
shared server, the queries migrate unchanged.

Why a database at all and not files? ACID transactions. When `txNext()` evaluates
conditions, advances the step, and updates the issue — all of that must be atomic.
If the process crashes mid-update, the state must be consistent. Files can't
guarantee that. A database can.

### Projections

**Projections** are the markdown files under `.twisted/` — issue summaries, cycle
reports, snapshot tables, checkpoint documents. They are a read-only view of the
database, generated for humans and git commits.

Projections can fail without data loss. If the filesystem write fails, the DB state
is already committed and correct. The next `tx status` or `tx next` call will
re-render. This is a deliberate design choice: projection is eventual, not
transactional.

The `ProjectionFlusher` batches renders. When the daemon processes a burst of
writes, it marks slugs as dirty and flushes every 500ms. This prevents N filesystem
writes for N rapid mutations — they coalesce into one render per slug.

### Skills

**Skills** are reusable methodology packages — instructions for how to do a kind
of work. A TDD skill teaches red-green-refactor. A PRD skill structures a user
interview into a product requirements document. A triage skill walks through bug
reports and produces actionable issue specs. New ones appear on GitHub constantly
as the community figures out what works.

The problem is that skills are written by different people with different
assumptions. One skill creates GitHub issues as output. Another writes files to
`./plans/`. A third makes git commits. twisted-workflow can't require every skill
author to conform to its pipeline — the ecosystem moves too fast and most skill
authors have never heard of this engine. Instead, the engine adapts to skills.

Skills are installed as dependencies, not bundled. `tx install` clones them from
git (or installs from npm) into `~/.twisted/projects/{id}/node_modules/`. After
installation, the agent analyzes each skill's SKILL.md, detects external outputs,
and generates a manifest with override suggestions that redirect those outputs
through the twisted-workflow pipeline. The skill author writes for a generic
audience. The manifest adapter translates for this specific engine. When the skill
updates, the agent re-analyzes and the manifest updates. No bespoke integration
code required.

This is the three-layer merge:
1. Skill content (SKILL.md from the package — untouched)
2. Manifest overrides (agent-derived on install — "skip step 7, use `tx issue` instead of `gh issue create`")
3. Config overrides (user-written in `.twisted/settings.json` — explicit wins)

## The Engine

### Expression Parser

Expressions use a custom grammar designed for readability in JSON/YAML config files.
Word-form operators (`and`/`or`/`not`) avoid the escaping problems of `&&`/`||`/`!`.
No arithmetic — expressions are conditions only.

```
expr         = or_expr
or_expr      = and_expr ('or' and_expr)*
and_expr     = not_expr ('and' not_expr)*
not_expr     = 'not' not_expr | compare_expr
compare_expr = member_expr (('==' | '!=' | '<' | '<=' | '>' | '>=') member_expr)?
member_expr  = call_expr ('.' IDENT)*
call_expr    = primary | IDENT '(' args ')'
primary      = LITERAL | IDENT | '(' expr ')'
```

The parser produces a typed AST with six node kinds: `literal`, `identifier`,
`member`, `call`, `binary`, `unary`. All parsing is synchronous and pure — no I/O,
no side effects, no state.

### Expression Evaluation

The evaluator walks the AST against an `ExpressionContext` built from database state:

```typescript
interface ExpressionContext {
  vars: Record<string, Json>;       // Prompt responses, stored per issue+step
  issue: IssueState;                // Type, step, status, timestamps
  artifacts: ArtifactContext;       // { all_present, exists(path) }
  tasks: TaskContext;               // { all_done, done_count, total_count }
  cycle: CycleContext | null;       // Active cycle or null
}
```

Key semantics:

**Null propagation.** `cycle.slug` when `cycle` is null returns null, not an error.
This is deliberate — expressions like `cycle.status == 'active'` should gracefully
handle the absence of a cycle, not crash.

**Short-circuit evaluation.** `false and expensive_check()` returns false without
evaluating the right side. `true or expensive_check()` returns true. This matters
for interactive functions.

**Interactive functions.** `confirm('Deploy?')` doesn't return a boolean — it returns
a `paused` signal with an `AgentAction`. The engine surfaces this to the CLI, the
agent asks the user, and on the next `txNext()` call, the response arrives via
`resume_response`. The response is stored in `vars` and the expression re-evaluates
with the answer available.

**Built-in functions:** `defined(value)`, `not_empty(value)`, `includes(array, item)`,
`count(array)` for deterministic checks. `confirm(msg)`, `prompt(msg)`,
`choose(msg, ...options)` for interactive pauses.

### DAG Resolution

Steps declare `needs` (predecessor step IDs), forming a directed acyclic graph.
The engine resolves execution order using Kahn's algorithm — a BFS-based
topological sort that processes steps level by level.

Each level is a parallel execution group: steps within a group have no dependencies
on each other. Today, twisted-workflow processes one step at a time. The group
information is preserved for future parallel agent dispatch.

Cycle detection walks dependency chains and reports each distinct cycle as an
ordered list of participating step IDs, providing meaningful diagnostics rather
than a generic "cycle detected" error.

### Step Evaluation

For each step in topological order, the evaluator resolves a state:

1. **Dependencies unmet?** → `pending` (skip — can't run yet)
2. **`skip_when` true?** → `skip` (add to completed set, check next)
3. **`done_when` true?** → `done` (add to completed set, check next)
4. **`block_when` true?** → `blocked` (stop — issue is stuck)
5. **Interactive expression paused?** → `paused` (stop — waiting for input)
6. **Matches current step?** → `active`
7. **Otherwise** → `ready` (eligible to start)

The completed set grows as steps are resolved, which unlocks downstream steps
whose `needs` are now satisfied. This is evaluated fresh on every `txNext()` call.

### XState Machine

An XState v5 machine is generated from each workflow definition at load time.
It serves as a **consistency check**, not the source of truth. If the machine
rejects a transition that the evaluator approved, the evaluator wins — it has
richer context (expression evaluation, vars, artifacts) than the machine (static
DAG structure).

The machine exists for one reason: to catch category errors where the DAG
resolution and the expression evaluation disagree about what's possible. In
practice, this has caught zero bugs — but the invariant check costs nothing
at runtime and provides confidence during engine changes.

### txNext: The Core Loop

Everything comes together in `txNext()`. This is the single function that
advances an issue through its workflow. It runs inside one database transaction:

```
1. Load issue by slug
2. Load workflow definition from config
3. If resume_response provided, store it in vars (so expressions can read it)
4. Build ExpressionContext:
   - vars:      SELECT key, value FROM vars WHERE issue_slug AND step
   - tasks:     SELECT done FROM tasks WHERE issue_slug
   - artifacts: Check which produces[].path keys exist in vars for this step
   - cycle:     SELECT id, slug, status FROM cycles WHERE status = 'active'
5. Evaluate all steps against the context
6. Handle the result:
   - paused  → return action for user/agent input
   - done    → advance to next ready step (or close issue if all done)
   - blocked → set issue status to blocked
   - active  → no change (step is in progress)
7. [Outside transaction] Run projection (swallow errors)
```

The transaction boundary is critical. Steps 1–6 are atomic: if the process crashes
after evaluating but before persisting, nothing changes. If it crashes after
persisting but before projection, the DB is correct and projection catches up on
the next call. Projection runs outside the transaction deliberately — a filesystem
error must never roll back a valid state transition.

## The Daemon in Depth

### Why a Daemon

The daemon exists because of a constraint: PGLite supports one connection. If two
agents call `tx next` simultaneously, their transactions would interleave
unpredictably. The daemon serializes all access through one process.

But the daemon does more than serialize. It also:

- **Auto-starts** on first `tx` command (no manual daemon management)
- **Batches projection** via dirty tracking (no filesystem thrash)
- **Owns the socket lifecycle** (clean shutdown, graceful reconnect)
- **Runs migrations** on startup (schema is always current)

### Socket Protocol

Newline-delimited JSON over Unix domain sockets (or Windows named pipes). One
request-response per connection:

```
CLI opens connection
CLI sends:   {"command":"next","issue_slug":"feat-auth"}\n
Daemon sends: {"status":"ok","data":{...}}\n
CLI closes connection
```

13 command types form a closed set. The dispatcher uses a TypeScript discriminated
union with an exhaustiveness guard — adding a new command to the type without
handling it is a compile error.

### Request Dispatch

Each command maps to a handler function. Handlers receive `StoragePort` (and
optionally `ProjectionPort`) plus the narrowed request type:

```typescript
handleNext(db, projection, req)     // Runs txNext
handleWrite(db, req)                // Stores artifact in vars table
handleCycleStart(db, req)           // Delegates to startCycle()
handleCycleClose(db, req)           // Delegates to closeCycle()
```

Handlers return `DaemonResponse`. The dispatcher marks dirty slugs for batched
projection. Handlers never call projection directly — that's the flusher's job.

### Projection Flushing

The `ProjectionFlusher` uses a `Set<string>` for dirty tracking. When a handler
writes to the DB, the dispatcher calls `flusher.markDirty(slug)`. Every 500ms,
the flusher renders all dirty slugs via `Promise.allSettled()` (parallel, error-
tolerant) and clears the set.

On shutdown, a final flush ensures no dirty slugs are lost. The timer is `unref()`'d
so it doesn't prevent Node.js from exiting.

## Storage

### Schema

Seven domain tables plus a migrations tracker:

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `issues` | All units of work | slug, type, workflow_id, step, status, parent_id, metadata (JSONB) |
| `cycles` | Focus containers | slug, title, status (active/closed), started_at, closed_at |
| `cycle_issues` | Which issues are in which cycle | cycle_id, issue_id, pulled_at, completed_at |
| `notes` | Typed observations | summary, tag (decide/defer/discover/blocker/retro), issue_slug |
| `checkpoints` | Session context bridges | number (sequential), summary, content, issue_slug |
| `vars` | Durable key-value store | issue_slug, step, key, value (JSONB) — also stores artifacts |
| `tasks` | Per-issue task lists | issue_slug, summary, done (0/1) |

**Design decisions that matter:**

All primary keys are TEXT (UUIDs generated at the app layer). PGLite's WASM build
doesn't include `uuid-ossp`, and importing it would add startup latency for no
benefit.

Timestamps are ISO 8601 TEXT strings. PGLite WASM has no timezone-aware clock.
Storing as text avoids timezone bugs and makes the data self-describing in JSON
exports.

The `vars` table doubles as artifact storage. When an agent runs `tx write scope`,
the handler stores the content in `vars` with `key = 'scope'` and
`step = issue.step`. This unifies artifact tracking with the expression system —
`artifacts.all_present` checks whether the step's `produces[].path` entries
exist as keys in `vars`.

### Migrations

A `_migrations` table tracks applied schema versions. The runner bootstraps this
table on startup, checks what's been applied, and runs new migrations inside
transactions. Currently there's one migration: the full initial schema. Adding
tables or columns is a new migration — the engine handles the upgrade path
automatically.

## Ports & Adapters

Every external dependency is behind an interface:

| Port | What it abstracts | Why |
|------|-------------------|-----|
| `StoragePort` | SQL database | Tests use in-memory PGLite; future could swap to server Postgres |
| `ProjectionPort` | Filesystem rendering | Tests use temp dirs; future could use S3 or HTTP |
| `TransportPort` | IPC communication | Unix sockets today; HTTP for future service mode |
| `ExpressionEvaluatorPort` | Condition evaluation | Swappable for custom expression languages |
| `PackageResolverPort` | Package installation | npm today; could support other registries |

The primary benefit is testability. Every integration test creates a fresh
`createInMemoryStorageAdapter()` — a real PGLite instance running in WASM with
the full schema applied. No mocks of SQL, no fake query results. The tests run
real queries against real Postgres and verify real behavior.

This is the testing philosophy throughout: 415 tests, zero mocks of internal
collaborators. Tests verify behavior through public interfaces. If a test breaks
when you refactor but behavior hasn't changed, the test was testing implementation,
not behavior.

## Dependencies & Skills

### Installation

Skill packages are declared in `.twisted/settings.json`:

```json
{
  "dependencies": {
    "@community/skills": "github:someone/skills"
  }
}
```

`tx install` handles two cases:

**npm packages** — runs `npm install <pkg> --prefix ~/.twisted/projects/{id}/`
and reads the package's `twisted` field from `package.json` for skill/persona
metadata.

**Git repos without `package.json`** — shallow clones into `node_modules/{name}/`,
scans for directories containing SKILL.md files, and writes a synthetic
`package.json` with the discovered skills. This matters because most skill repos
in the wild are just flat directories of markdown files — not npm packages. The
ecosystem hasn't standardized on a distribution format yet, and the engine
shouldn't wait for it to. It adapts to whatever it finds.

Packages live in `~/.twisted/projects/{id}/node_modules/` — out of the repo,
in user-local space. Each project gets its own isolated dependency tree.

### Manifest Discovery

After installation, `tx install -a` returns a `prompt_user` action with a
structured prompt. The orchestrating agent reads each SKILL.md, identifies
external side effects, and writes a manifest via `tx manifest write`.

The manifest records what each skill does and how to adapt it:

```json
{
  "@community/skills": {
    "version": "0.0.0-git",
    "discovered": "2026-04-03T05:00:00.000Z",
    "skills": {
      "write-a-prd": {
        "description": "Create a PRD through user interview",
        "detected_outputs": ["github-issue"],
        "suggested_overrides": {
          "omit": ["Step 5"],
          "directives": [
            "Do NOT submit as GitHub issue. Use tx write scope."
          ]
        }
      }
    }
  }
}
```

This is agent-driven, not regex-based. The agent understands the skill's intent
and generates contextually appropriate overrides. A regex can match "create a
GitHub issue" — an agent can understand that step 5 is the output step and that
the workflow equivalent is `tx write scope`, not just "don't do it."

### Three-Layer Merge

At runtime, skill invocation merges three layers:

1. **Skill content** — the raw SKILL.md from `node_modules/`
2. **Manifest overrides** — agent-derived on install ("skip step 5, redirect to `tx write`")
3. **Config overrides** — user-written in `.twisted/settings.json` (explicit wins)

This means you can install any skill from the ecosystem, get smart defaults from
the manifest, and customize further in your config. The skill author doesn't need
to know about twisted-workflow. The manifest adapter bridges the gap. When the
skill publishes a new version that changes its output format, re-running
`tx install --force` regenerates the manifest with updated overrides. No code
changes, no manual adapter maintenance — the agent re-analyzes and adapts.

## The CLI

### Thin Client

The CLI has zero business logic. Every command (except `init`, `install`,
`manifest`) serializes a `DaemonRequest`, sends it over the socket, and prints
the `DaemonResponse`. The daemon does all the work.

`tx init` runs locally because the daemon may not exist yet when init is called.
`tx install` and `tx manifest` run locally because they manage files in the user
directory, not the DB.

### Auto-Start

Before the first socket send, `ensureDaemon()` probes for a running daemon with
a 2-second timeout. If not reachable, it starts one via `startDaemon()` and
retries up to 3 times with 500ms delays. The user never manually manages the
daemon.

### Agent Protocol

Every command with `-a` returns an `AgentResponse`:

```typescript
interface AgentResponse {
  status: 'ok' | 'error' | 'paused' | 'handoff';
  command: string;
  action?: AgentAction;      // What the agent should do next
  display?: string;          // Human-readable output
  issue?: IssueState;        // Current issue snapshot
  error?: string;
}
```

The `action` field is the interface between the engine and the agent layer.
Six action types form a closed protocol:

| Action | Agent behavior |
|--------|---------------|
| `invoke_skill` | Load and execute the named skill |
| `confirm` | Display message, run `next_command` to proceed |
| `prompt_user` | Execute the step described in `prompt` |
| `run_agents` | Spawn sub-agents for parallel work |
| `done` | Pipeline complete |
| `install_cli` | Show CLI installation instructions |

The orchestrating agent (the `/tx` skill in Claude Code) reads the response,
executes the action, and calls the next command. The engine drives the agent,
not the other way around.

## Test Architecture

415 tests across 37 files. Three layers, one philosophy: test behavior through
public interfaces, never mock internal collaborators.

| Layer | Count | What's tested | Adapter |
|-------|-------|--------------|---------|
| Unit | ~150 | Parser, evaluator, DAG, context builders, renderers, retro generation | None (pure functions) |
| Integration | ~200 | Handlers, CRUD, lifecycle, txNext, config merge, validation | In-memory PGLite |
| E2E | ~65 | Full flows: issue lifecycle, cycle lifecycle, checkpoints, projection | In-memory PGLite + real temp filesystem |

Each integration/E2E test gets a fresh `createInMemoryStorageAdapter()` — a real
PGLite WASM instance with the full schema applied. No cross-test leakage. Projection
tests use real temp directories, created in `beforeEach` and cleaned up in `afterEach`.

The TDD methodology is vertical slices: one test, one implementation, repeat.
Each test responds to what you learned from the previous cycle. Horizontal slicing
(all tests first, all implementation second) produces tests that verify imagined
behavior, not actual behavior.
