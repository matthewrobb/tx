# twisted-workflow v4 — Technical Design

## Overview

twisted-workflow is a data-driven workflow engine for agentic development with
Claude Code. The engine is workflow-agnostic: steps, artifacts, transitions,
conditions, and issue types are all defined in configuration, not code. The
simplest valid workflow is one step. The most complex is an arbitrary DAG with
expression-based guards, interactive prompts, and skill-based automation.

**Core invariants:**
- PGLite (embedded Postgres via WASM) is the single source of truth
- The daemon owns the DB exclusively — single writer, no contention
- The CLI is a thin socket client — zero business logic
- Markdown projection is a read-only view for humans and git
- Expressions evaluate against DB state, never the filesystem

## Architecture

### Three-Layer Split

```
Engine (generic, workflow-agnostic):
  Expression parser + evaluator
  DAG resolver (topological sort)
  XState machine generator (consistency check)
  txNext — atomic evaluate → advance → persist loop
  Projection flusher (DB → filesystem markdown)

Vocabulary (data, not code):
  Workflow definitions (steps, conditions, artifacts)
  Built-in defaults (feature, bug, chore, spike)
  Skill packages (npm or git dependencies)

CLI (thin socket client):
  Serialize request → send to daemon → print response
  Local commands: init, install, uninstall, manifest
```

### Ports & Adapters

Abstract concrete technology behind interfaces. Tests inject in-memory
adapters; production uses real implementations.

| Port | Interface | Default Adapter | Purpose |
|------|-----------|----------------|---------|
| `StoragePort` | `query()`, `exec()`, `transaction()` | `PGLiteStorageAdapter` | SQL persistence with ACID transactions |
| `ProjectionPort` | `renderIssue()`, `renderCycle()`, etc. | `MarkdownProjectionAdapter` | DB → filesystem rendering |
| `TransportPort` | `send()`, `close()`, `connected` | `SocketTransportAdapter` | IPC between CLI and daemon |
| `ExpressionEvaluatorPort` | `evaluate()`, `validate()` | `ExpressionEvaluator` | Condition evaluation |
| `PackageResolverPort` | `install()`, `resolve()`, `discover()` | `NpmPackageResolver` | Skill/persona package management |

#### StoragePort

```typescript
interface StoragePort {
  query<T>(sql: string, params?: unknown[], tx?: StorageTx): Promise<QueryResults<T>>;
  exec(sql: string, tx?: StorageTx): Promise<Array<QueryResults<unknown>>>;
  transaction<T>(callback: (tx: StorageTx) => Promise<T>): Promise<T>;
}

interface StorageTx {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResults<T>>;
  exec(sql: string): Promise<Array<QueryResults<unknown>>>;
  rollback(): Promise<void>;
  readonly closed: boolean;
}
```

Transactions are composable: pass `tx` to `query()` to participate in an
existing transaction. PGLite's internal mutex serializes concurrent queries,
so explicit request queuing is unnecessary.

#### ProjectionPort

```typescript
interface ProjectionPort {
  renderIssue(issueSlug: string): Promise<void>;
  renderCycle(cycleSlug: string): Promise<void>;
  renderCheckpoint(checkpointId: string): Promise<void>;
  renderSnapshot(): Promise<void>;
  deleteIssue(issueSlug: string): Promise<void>;
}
```

One-way rendering. Each method queries the DB for fresh data and writes
markdown to the filesystem. Projection failures never roll back DB state.

## Data Model

### PGLite Schema

All state lives in 7 domain tables plus a migrations tracker.

```sql
-- The unit of work. Recursive via parent_id.
CREATE TABLE issues (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL,            -- feature | bug | spike | chore | release
  workflow_id TEXT NOT NULL,            -- references workflow definition by id
  step        TEXT NOT NULL,            -- current step within the workflow
  status      TEXT NOT NULL DEFAULT 'open',  -- open | blocked | done | archived
  parent_id   TEXT REFERENCES issues(id),
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,            -- ISO 8601
  updated_at  TEXT NOT NULL
);

-- Optional focus container. One active at a time.
CREATE TABLE cycles (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | closed
  started_at  TEXT NOT NULL,
  closed_at   TEXT
);

-- Join table: which issues are in which cycle.
CREATE TABLE cycle_issues (
  cycle_id     TEXT NOT NULL REFERENCES cycles(id),
  issue_id     TEXT NOT NULL REFERENCES issues(id),
  pulled_at    TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (cycle_id, issue_id)
);

-- Typed notes attached to issues or cycles.
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  summary    TEXT NOT NULL,
  tag        TEXT NOT NULL,             -- decide | defer | discover | blocker | retro
  issue_slug TEXT,
  cycle_slug TEXT,
  created_at TEXT NOT NULL
);

-- Context bridges between LLM sessions.
CREATE TABLE checkpoints (
  id         TEXT PRIMARY KEY,
  number     INTEGER NOT NULL,          -- sequential within the project
  issue_slug TEXT,
  summary    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Durable key-value store scoped to issue + step.
-- Used for: prompt responses, artifact content, session state.
CREATE TABLE vars (
  issue_slug TEXT NOT NULL,
  step       TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  PRIMARY KEY (issue_slug, step, key)
);

-- Task list per issue.
CREATE TABLE tasks (
  id         TEXT PRIMARY KEY,
  issue_slug TEXT NOT NULL,
  summary    TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,  -- PGLite stores booleans as 0/1
  created_at TEXT NOT NULL
);
```

**Design decisions:**
- All PKs are TEXT (UUIDs generated at app layer) — avoids `uuid-ossp` extension unavailable in PGLite WASM
- Timestamps are ISO 8601 TEXT — PGLite WASM has no timezone-aware clock
- JSONB for `metadata` and `vars.value` — queryable, partially updatable
- `vars` table doubles as artifact storage: `handleWrite` stores artifact content with `key = artifact_type`
- No foreign key from `issues.workflow_id` to a workflows table — workflows are config, not DB rows

### File Layout

```
~/.twisted/projects/{project-id}/     User-local (not committed)
  twisted.db                          PGLite database files
  node_modules/                       Installed skill packages
  skill-manifest.json                 Agent-generated skill analysis

.twisted/                             In-project (committed)
  settings.json                       Config overrides
  issues/{slug}.md                    Projected issue markdown
  cycles/{slug}.md                    Projected cycle markdown
  checkpoints/{n}-{id}.md             Projected checkpoints
  snapshot.md                         All issues at a glance
```

## Engine

### Expression System

All conditions are expressions evaluated against a typed context. The
engine never reads from the filesystem — all evaluation is against DB state.

#### Grammar

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

Word-form `and`/`or`/`not` (not `&&`/`||`/`!`) for YAML/JSON readability.
No arithmetic — expressions are conditions only.

#### AST

```typescript
type ExpressionNode =
  | { kind: 'literal'; value: Json }
  | { kind: 'identifier'; name: string }
  | { kind: 'member'; object: ExpressionNode; property: string }
  | { kind: 'call'; callee: ExpressionNode; args: ExpressionNode[] }
  | { kind: 'binary'; op: BinaryOp; left: ExpressionNode; right: ExpressionNode }
  | { kind: 'unary'; op: 'not'; operand: ExpressionNode };

type BinaryOp = 'and' | 'or' | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
```

#### Evaluation Context

```typescript
interface ExpressionContext {
  vars: Record<string, Json>;       // User-defined variables from step outputs
  issue: IssueState;                // step, status, type, workflow_id, etc.
  artifacts: ArtifactContext;       // { all_present: boolean, exists(path): boolean }
  tasks: TaskContext;               // { all_done: boolean, done_count, total_count }
  cycle: CycleContext | null;       // Active cycle or null
}
```

Context is built fresh for each `txNext()` call from DB state:
- `vars`: `SELECT key, value FROM vars WHERE issue_slug = $1 AND step = $2`
- `tasks`: `SELECT done FROM tasks WHERE issue_slug = $1`
- `artifacts`: Step's `produces[].path` matched against vars keys for that step
- `cycle`: `SELECT id, slug, status FROM cycles WHERE status = 'active' LIMIT 1`

#### Evaluation Semantics

- **Null propagation:** `cycle.slug` returns `null` when `cycle` is `null` (no error)
- **Short-circuit:** `false and X` → `false`; `true or X` → `true`
- **Truthiness:** `null`, `false`, `0`, `''` are falsy; everything else is truthy
- **Equality:** `==`/`!=` use deep JSON equality via `JSON.stringify`
- **Comparison:** `<`/`<=`/`>`/`>=` return `false` for non-numeric operands
- **Paused propagation:** If any sub-expression returns `{ ok: 'paused' }`, stop immediately

#### Built-in Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `defined(value)` | boolean | True if value is not null |
| `not_empty(value)` | boolean | True for non-empty string/array/object |
| `includes(array, item)` | boolean | Structural equality check |
| `count(array)` | number | Array length (null for non-arrays) |

**Interactive functions** (pause evaluation for user input):

| Function | AgentAction | Purpose |
|----------|------------|---------|
| `confirm(message)` | `{ type: 'confirm' }` | Yes/no from user |
| `prompt(message)` | `{ type: 'prompt_user' }` | Free-text input |
| `choose(message, ...options)` | `{ type: 'prompt_user' }` | Multiple choice |

When an interactive function fires, the evaluator returns `{ ok: 'paused', action }`.
The daemon returns this to the CLI, the agent collects the user's response, and
re-invokes `txNext` with `resume_response`. The response is stored in `vars` as
`resume_response` before re-evaluation.

### DAG Resolution

Steps declare `needs` (predecessor step IDs). The engine resolves execution
order via Kahn's algorithm (BFS-based topological sort).

```typescript
type DagResult =
  | { ok: true; order: string[]; groups: string[][] }
  | { ok: false; cycles: string[][] };
```

`groups` are parallel execution groups — steps within a group have no
dependencies on each other and could run concurrently. Cycle detection
traces individual cycles for meaningful error diagnostics.

### Step Evaluation

For each step in topological order:

1. **Check dependencies** — if any `needs` step not done/skip → `pending`
2. **Evaluate `skip_when`** — if true → `skip` (add to completed set)
3. **Evaluate `done_when`** — if true → `done` (add to completed set)
4. **Evaluate `block_when`** — if true → `blocked`
5. **Check if current step** — if matches `issue.step` → `active`
6. **Otherwise** → `ready`

Resolution states: `pending | ready | active | skip | done | blocked | paused`

### XState Machine (Consistency Check)

A machine is generated from each workflow definition at load time. It serves
as a **consistency check**, not the source of truth. If the machine rejects
a transition that the evaluator approved, the evaluator wins (it has more
information via expression context).

```typescript
type WorkflowEvent =
  | { type: 'STEP_DONE'; step: string }
  | { type: 'STEP_SKIP'; step: string }
  | { type: 'STEP_BLOCK'; step: string }
  | { type: 'RESET' };

interface WorkflowContext {
  current_step: string;
  completed_steps: string[];
  status: IssueStatus;
}
```

The machine uses `findNextStep()` to compute the next eligible step: the
first step in topological order whose `needs` are all in the completed set.

### txNext — The Core Loop

All mutations happen inside a single DB transaction:

```
1. Load issue by slug
2. Load workflow from config
3. Store resume_response in vars (if present)
4. Build ExpressionContext (vars, tasks, artifacts, cycle)
5. Evaluate all steps
6. Handle result:
   - paused   → return action for user input
   - done/skip → advance to next ready step (or close issue)
   - blocked  → set issue status to blocked
   - active   → no change
7. [Outside transaction] Run projection (swallow errors)
```

Result type:
```typescript
type TxNextResult =
  | { status: 'advanced'; issue: IssueState; from_step: string; to_step: string }
  | { status: 'done'; issue: IssueState }
  | { status: 'blocked'; issue: IssueState; step: string }
  | { status: 'paused'; issue: IssueState; action: AgentAction }
  | { status: 'no_change'; issue: IssueState }
  | { status: 'error'; message: string };
```

## Daemon

### Socket Protocol

Newline-delimited JSON over Unix domain sockets (or Windows named pipes).
One request/response per connection: CLI opens, sends, reads response, closes.

```
CLI → daemon: { "command": "next", "issue_slug": "feat-auth" }\n
daemon → CLI: { "status": "advanced", "data": { ... } }\n
```

### Request Dispatch

The `dispatch()` function routes `DaemonRequest` to handler functions via
a `switch` on `req.command`. Each handler receives `StoragePort` (and
optionally `ProjectionPort`) plus the narrowed request type.

13 commands: `next`, `status`, `open`, `close`, `write`, `read`, `note`,
`pickup`, `handoff`, `checkpoint`, `cycle_start`, `cycle_pull`, `cycle_close`.

Exhaustiveness guard: a `never` default case ensures TypeScript errors if
a new command is added to the union but not handled.

### Projection Flushing

The `ProjectionFlusher` batches filesystem writes:

- **Dirty tracking:** `Set<string>` deduplicates rapid writes to the same slug
- **500ms interval:** Timer-based flush coalesces writes
- **Parallel render:** `Promise.allSettled()` renders independent issues concurrently
- **Error resilience:** Projection errors are swallowed; DB is source of truth
- **Graceful shutdown:** Final flush on `stop()`; timer is `unref()`'d to not block exit

### Auto-Start

Before the first socket send, `ensureDaemon()` probes for a running daemon.
If not reachable, it calls `startDaemon()` and retries 3 times with 500ms
delays. The daemon creates its PGLite adapter (which runs migrations),
binds the socket, and starts listening.

## Config Resolution

Two-layer merge: built-in defaults + project settings.

```
resolveConfig(settings?) → TwistedConfig
  = deepMerge(DEFAULT_CONFIG, settings ?? {})
```

Workflow merging uses id-based matching:
- Same id as a built-in → field-level merge (user wins)
- `extends` another workflow → base + user overlay
- New id → appended to the workflow list

Three-layer merge with packages:
```
1. Built-in defaults
2. + Package manifest (workflows, skills from node_modules)
3. + User config (.twisted/settings.json)
```

### Default Workflows

| Workflow | Steps | Default for |
|----------|-------|-------------|
| `feature` | research → scope → plan → build | `feature` |
| `bug` | reproduce → fix → verify | `bug` |
| `chore` | do | `chore` |
| `spike` | research → recommend | `spike` |

No skills configured by default. Steps have no `done_when`/`skip_when`/
`block_when` — they advance only when the agent explicitly calls `tx next`.

### Config Validation

`resolveConfig()` validates:
- Phase categories exist for all referenced phases
- Step `needs` form a valid DAG (no cycles via Kahn's algorithm)
- Expression syntax parses correctly
- Workflow `extends` chains don't form cycles
- No duplicate workflow IDs

## Dependency Management

### Installation

Skill packages are declared in `.twisted/settings.json`:

```json
{
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  }
}
```

`tx install` resolves each dependency:
- **npm packages:** `npm install <pkg> --prefix ~/.twisted/projects/{id}/`
- **GitHub repos:** `git clone --depth 1` into `node_modules/{name}/`

For git repos without `package.json`, the installer scans for SKILL.md
directories and writes a synthetic `package.json` with discovered skills.

### Manifest Discovery

After installation, `tx install -a` returns a `prompt_user` action instructing
the agent to:

1. Read each SKILL.md file
2. Detect external outputs (GitHub issues, PRs, file writes, git ops, etc.)
3. Generate override directives redirecting outputs through the pipeline
4. Pipe the manifest JSON to `tx manifest write`

The manifest is cached at `~/.twisted/projects/{id}/skill-manifest.json`.
At runtime, the three-layer merge applies:

```
1. Skill content (SKILL.md from node_modules)
2. + Manifest overrides (agent-derived on install)
3. + Config overrides (.twisted/settings.json, user-written)
```

### CLI Commands

```
tx install [package] [--force]    Install from settings or by name
tx uninstall <package>            Remove package + manifest entry
tx manifest write                 Write manifest from stdin (JSON)
tx manifest show                  Show current manifest
```

`--force` deletes the existing package directory before re-installing.
`tx uninstall` removes both the package directory and its manifest entry.

## CLI Protocol

Every `tx` command with `-a` returns an `AgentResponse`:

```typescript
interface AgentResponse {
  status: 'ok' | 'error' | 'paused' | 'handoff';
  command: string;
  action?: AgentAction;
  display?: string;
  issue?: IssueState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}

type AgentAction =
  | { type: 'invoke_skill'; skill: string; prompt?: string }
  | { type: 'confirm'; message: string; next_command: string }
  | { type: 'done' }
  | { type: 'prompt_user'; prompt: string; categories?: string[] }
  | { type: 'run_agents'; agents: AgentAssignment[] }
  | { type: 'install_cli'; instructions: string };
```

The orchestrating agent reads `action` to know what to do next. The action
types form a closed protocol between the engine and the agent layer.

## Test Architecture

415 tests across 37 files. Three layers:

| Layer | What's tested | Adapter |
|-------|--------------|---------|
| Unit | Pure functions: parser, evaluator, DAG, context builders, renderers | None |
| Integration | Handlers, CRUD, lifecycle, txNext, config merge | In-memory PGLite |
| E2E | Full flows: issue lifecycle, cycle lifecycle, checkpoints | In-memory PGLite + real temp filesystem |

In-memory PGLite runs the full schema via `createInMemoryStorageAdapter()`.
Each test gets a fresh DB instance — no cross-test leakage. Projection tests
use real temp directories cleaned up in `afterEach`.

No mocks of internal collaborators. Tests verify behavior through public
interfaces. The warning sign from the TDD skill applies: "your test breaks
when you refactor, but behavior hasn't changed" means the test was wrong.
