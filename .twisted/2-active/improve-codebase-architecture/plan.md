# Implementation Plan: v4 Data-Driven Workflow Engine

> XL estimate, 21-day timebox, confidence 3/5.
> Complete cutover — no migration from v3. Existing code is reference only.

## Guiding Principles

1. **Types first** — every wave starts with type definitions before implementation
2. **Ports shaped by adapters** — design interfaces from real PGLite API, not speculation
3. **Test at boundaries** — PGLite in-memory mode for tests (no separate adapter needed). All tests live in `__tests__/` directories, not co-located with source files.
4. **DB is truth** — engine never reads filesystem; projections are one-way DB → FS
5. **Daemon is the one path** — CLI is a thin socket client, no direct mode
6. **Wave-parallel execution** — stories within a wave run as concurrent subagents
7. **Precise types, no escape hatches** — `unknown`, `any`, and `Record<string, any>` require written justification at the usage site. Prefer discriminated unions, branded types, and narrow interfaces. If a type is hard to express, that's a design signal — fix the design, don't widen the type.
8. **Tests prove behavior, not types** — never write tests that assert type shapes, check `typeof`, or validate that a field exists. TypeScript's compiler already guarantees this. Tests cover runtime behavior only: state transitions, side effects, error paths, expression evaluation, DB queries. If a test would pass with `as any` removed, it's testing the wrong thing.
9. **Decisions live in the code** — when a choice is reasonably subjective (why this data structure, why this pattern over an alternative, why this tradeoff), inline the reasoning as a comment at the decision site. TODO, NOTE, HACK, and FIXME annotations go in the code too, not in external docs. The code is the single source of truth for *why* — a future reader shouldn't need to find a PR description or Slack thread to understand the rationale.

## Branch Strategy

All v4 implementation work happens on a new branch off `main`. Before branching:

1. **Commit all plan artifacts** on `main` (research, scope, estimate, plan, stories)
2. **Switch `npm link`** for `tx` to the worktree at `C:\Users\Mrobb\Projects\twisted-workflow\.claude\worktrees\twisted-workflow` — this keeps the working `tx` CLI available from the stable worktree while the main repo is being rewritten
3. **Create branch** (e.g., `v4-data-driven-engine`) off `main`
4. Begin Wave 0

The worktree at `.claude/worktrees/twisted-workflow` runs the current v3 `tx` binary. The main repo branch will have a broken `tx` during rewrite. The `npm link` swap ensures `/tx` commands keep working throughout.

---

## PGLite API Reference

Research confirmed PGLite (Postgres 17 compiled to WASM) has a clean, predictable API.
These findings eliminate storage-layer risk and directly inform StoragePort design.

### Transaction API

Callback-based with passable `tx` handle. Auto-commits on resolve, auto-rollbacks on reject:

```typescript
// Signature
db.transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>

// Transaction interface — same query methods as PGlite itself
interface Transaction {
  query<T>(query: string, params?: any[], options?: QueryOptions): Promise<Results<T>>
  sql<T>(strings: TemplateStringsArray, ...params: any[]): Promise<Results<T>>
  exec(query: string, options?: QueryOptions): Promise<Array<Results>>
  rollback(): Promise<void>
  get closed(): boolean
}
```

**StoragePort implication:** Methods accept optional `tx?: Transaction` and use `tx ?? db`
internally. This is the standard pattern for composable transactions.

### Connection Model

Single connection with internal mutex serialization. Concurrent `await db.query()` calls
queue behind a mutex — they don't error, they wait. No connection pool needed or possible.

**StoragePort implication:** No `acquire()`/`release()` lifecycle. Just `query()` and
`transaction()`. Matches the daemon's single-writer architecture perfectly.

### Query API

```typescript
// Generic typed results with parameterized queries
db.query<T>(query: string, params?: any[], options?: QueryOptions): Promise<Results<T>>

// Tagged template literal (auto-parameterized)
db.sql<T>`SELECT * FROM issues WHERE slug = ${slug}`

// Results shape
interface Results<T> {
  rows: T[]
  affectedRows?: number
  fields: { name: string; dataTypeID: number }[]
}
```

### JSONB Support

Full Postgres 17 JSONB — all operators (`->`, `->>`, `@>`, `jsonb_set`, `jsonb_build_object`),
GIN indexes, everything. It's real Postgres compiled to WASM, not a reimplementation.

### Lifecycle

```typescript
// Static factory (returns ready instance)
const db = await PGlite.create()                    // in-memory
const db = await PGlite.create('./data/')           // filesystem (Node)
const db = await PGlite.create('idb://mydb')        // IndexedDB (browser)

// Full DB export for snapshot/recovery
const dump = await db.dumpDataDir(compression?: 'auto' | 'gzip' | 'none'): Promise<Blob>

// Restore from dump
const db = await PGlite.create({ loadDataDir: dump })
```

### Error Handling

Real Postgres `DatabaseError` with SQLSTATE codes (`23505` for unique violation,
`42P01` for undefined table, etc.). Standard error fields: code, message, detail, hint.

### Test Strategy

PGLite in-memory mode (`PGlite.create()`) is fast enough for tests. **No separate
in-memory storage adapter needed.** Same adapter, different constructor arg. Tests get
real Postgres behavior including JSONB queries, constraints, and transactions.

### Savepoints

No typed API, but raw `SAVEPOINT` / `ROLLBACK TO` SQL works inside transaction callbacks.

### Extensions Available

pgvector, pgcrypto, uuid-ossp, pg_uuidv7, ltree, pg_trgm, citext, hstore, and full
`contrib/` suite. Loaded via `{ extensions: { vector } }` constructor option.

---

## Execution Model: Waves

Stories are ordered by dependency, not conceptual grouping. Each wave runs as
concurrent subagents. A wave starts only when all its dependencies are complete.

### Story List (25 active stories)

Changes from initial decomposition:
- **Merged S-021 (AgentResponse) into S-001** — it's just more type definitions
- **Merged S-004 (in-memory adapter) into S-003** — PGLite in-memory mode replaces separate adapter
- Original IDs preserved to match story tracker. S-004 and S-021 marked done (absorbed).

### Model Assignment

Subagents use the `model` parameter (`opus`, `sonnet`, `haiku`) to match story complexity:

- **opus** — foundational types everything depends on, complex algorithms, orchestration logic, architectural decisions
- **sonnet** — well-defined contracts, CRUD implementations, mechanical adapters, template-driven work
- **haiku** — simple generation, formatting, schema output

| ID | Story | Wave | Model | Depends On |
|----|-------|------|-------|------------|
| S-001 | Define core v4 types incl. AgentResponse | 0 | **opus** | — |
| S-002 | Define port interfaces (StoragePort, TransportPort, ProjectionPort, ExpressionEvaluatorPort, PackageResolverPort) | 0 | **opus** | — |
| S-003 | Implement PGLite storage adapter with schema, migrations, JSONB query builders (in-memory mode for tests) | 1 | **sonnet** | S-001, S-002 |
| ~~S-004~~ | ~~Absorbed into S-003~~ | — | — | — |
| S-005 | Build expression parser (tokenizer + AST) and evaluator with context namespace resolution | 1 | **opus** | S-002 |
| S-006 | Implement interactive expression functions (confirm, prompt, choose) with pause/resume semantics | 2 | **opus** | S-005 |
| S-007 | Config validation with branded ValidConfig, extends chain resolution, and structured errors | 2 | **opus** | S-001, S-005 |
| S-008 | DAG resolver: topological sort, parallel group detection, cycle detection from workflow step needs | 1 | **opus** | S-001 |
| S-009 | XState v5 machine generator: workflow definition to state machine config at load time | 2 | **opus** | S-001, S-008 |
| S-010 | Step evaluation against DB state via expressions (skip, block, done, needs resolution) | 2 | **opus** | S-001, S-002, S-005 |
| S-011 | Atomic txNext(): orchestrate evaluate, machine, persist in single DB transaction | 3 | **opus** | S-009, S-010, S-003 |
| S-012 | Issue CRUD: create, update, close, archive, list with recursive parent/child hierarchy | 2 | **sonnet** | S-001, S-002, S-003 |
| S-013 | Deferrals: create sibling issues with traceability metadata and deferral notes | 3 | **sonnet** | S-012 |
| S-014 | Issue workflow: assign workflow by type, advance independently via tx next without cycle | 4 | **opus** | S-012, S-011 |
| S-015 | Cycle lifecycle: start, pull issues, close with retro + checkpoint generation | 5 | **sonnet** | S-012, S-014 |
| S-016 | Checkpoint system: handoff/pickup context bridges between LLM sessions | 1 | **sonnet** | S-001, S-002 |
| S-017 | Policy engine: expression-based deferral/decision/scope_change/issue_create policies with pause semantics | 3 | **opus** | S-005, S-006 |
| S-018 | Daemon server: PGLite owner, request queue, dirty tracking, batched flush, recovery | 4 | **opus** | S-011, S-003 |
| S-019 | Socket transport adapter with named pipe support on Windows | 1 | **sonnet** | S-002 |
| S-020 | CLI: thin socket client with all commands and agent response contract | 5 | **sonnet** | S-018, S-019 |
| ~~S-021~~ | ~~Absorbed into S-001~~ | — | — | — |
| S-022 | Projection adapter: DB to filesystem markdown rendering (open, active, closed, checkpoints, snapshot) | 2 | **sonnet** | S-001, S-002, S-003 |
| S-023 | Skill/persona npm resolution: install, discover, manifest, 3-layer merge | 3 | **sonnet** | S-002, S-007 |
| S-024 | Guided setup: conversational tx init flow with workflow templates and skill suggestions | 4 | **sonnet** | S-007, S-023 |
| S-025 | Workflow migration: tx migrate with declarative rules and agent-aided structural changes | 4 | **opus** | S-007, S-011 |
| S-026 | Build system: JSON schema generation for all types, SKILL.md update, commit templates | 1 | **haiku** | S-001 |
| S-027 | End-to-end lifecycle tests: full issue, cycle, deferral, checkpoint, and migration flows | 6 | **opus** | S-011, S-012, S-013, S-015, S-016, S-025 |

### Wave Map

```
Wave 0 (2 stories) ─────────────────────────────────────────────────
  S-001  Core v4 types + AgentResponse
  S-002  Port interfaces

Wave 1 (6 stories) ─────────────────────────────────────────────────
  S-003  PGLite storage adapter          [S-001, S-002]
  S-005  Expression parser + evaluator   [S-002]
  S-008  DAG resolver                    [S-001]
  S-019  Socket transport                [S-002]
  S-016  Checkpoint system               [S-001, S-002]
  S-026  Build system / schemas          [S-001]

Wave 2 (6 stories) ─────────────────────────────────────────────────
  S-006  Interactive expressions         [S-005]
  S-007  Config validation               [S-001, S-005]
  S-009  Machine generator               [S-001, S-008]
  S-010  Step evaluation                 [S-001, S-002, S-005]
  S-012  Issue CRUD                      [S-001, S-002, S-003]
  S-022  Projection adapter              [S-001, S-002, S-003]

Wave 3 (4 stories) ─────────────────────────────────────────────────
  S-011  Atomic txNext                   [S-009, S-010, S-003]
  S-013  Deferrals                       [S-012]
  S-017  Policy engine                   [S-005, S-006]
  S-023  Skill/persona resolution        [S-002, S-007]

Wave 4 (4 stories) ─────────────────────────────────────────────────
  S-014  Issue workflow                  [S-012, S-011]
  S-018  Daemon server                   [S-011, S-003]
  S-024  Guided setup                    [S-007, S-023]
  S-025  Workflow migration              [S-007, S-011]

Wave 5 (2 stories) ─────────────────────────────────────────────────
  S-015  Cycle lifecycle                 [S-012, S-014]
  S-020  CLI                            [S-018, S-019]

Wave 6 (1 story) ───────────────────────────────────────────────────
  S-027  End-to-end tests               [S-011, S-012, S-013, S-015, S-016, S-025]
```

### Critical Path

Two paths of equal depth converge at S-011 (txNext):

```
S-002 → S-005 → S-010 → S-011 → S-014 → S-015 → S-027
S-001 → S-008 → S-009 → S-011 → S-018 → S-020
```

**S-011 (txNext) is the central bottleneck** — everything downstream waits on it.

### Wave Execution Summary

| Wave | Width | Stories | Cumulative |
|------|-------|---------|------------|
| 0 | 2 | Foundation types + ports | 2 |
| 1 | **6** | Adapters + pure algorithms | 8 |
| 2 | **6** | Engine components + domain models | 14 |
| 3 | 4 | Orchestration + policies | 18 |
| 4 | 4 | Workflows + daemon + setup | 22 |
| 5 | 2 | Cycles + CLI | 24 |
| 6 | 1 | E2E tests | 25 |

**7 waves** (down from 8 phases), **max width 6** (up from ~2 parallel).

---

## Wave Details

### Wave 0: Foundation (Days 1–2)

**S-001: Core Types** and **S-002: Port Interfaces** — the two stories everything depends on.

Types include all domain entities (Issue, Cycle, Workflow, StepDef, Phase, Artifact,
Note, Checkpoint), config types (ValidConfig, PhaseCategory), protocol types
(DaemonRequest, DaemonResponse, AgentResponse, AgentAction), and expression types.

Port interfaces are shaped by PGLite's actual API (see PGLite section above):

```
src/ports/
├── storage.ts        ← StoragePort: query<T>(), transaction<T>(), exec()
├── transport.ts      ← TransportPort: send/receive daemon messages
├── projection.ts     ← ProjectionPort: DB → filesystem rendering
├── expression.ts     ← ExpressionEvaluatorPort: evaluate(expr, context)
├── packages.ts       ← PackageResolverPort: install, resolve, discover
└── index.ts
```

StoragePort mirrors PGLite's interface — methods accept optional `tx?: Transaction`
for composable transactions. No connection pool, no acquire/release.

### Wave 1: Adapters + Pure Algorithms (Days 2–5)

Six concurrent stories. Three implement port interfaces, three are independent modules.

**S-003: PGLite adapter** — implements StoragePort with schema, migrations, JSONB
query builders. Uses PGLite in-memory mode for tests (no separate adapter).

**S-005: Expression parser** — tokenizer + AST for the expression grammar. Implements
ExpressionEvaluatorPort. Context namespaces resolve lazily against DB queries.

**S-008: DAG resolver** — pure algorithm. Topological sort, parallel group detection,
cycle detection. Input: workflow step `needs` graph. Output: ordered steps + parallel groups.

**S-019: Socket transport** — implements TransportPort. Named pipes on Windows.

**S-016: Checkpoint system** — CRUD for context bridge snapshots. Stored in DB,
projected to `.twisted/checkpoints/{n}.md`.

**S-026: Build system** — JSON schema generation from types. SKILL.md generation.
Commit template system.

### Wave 2: Engine Components + Domain Models (Days 5–8)

Six concurrent stories building on Wave 1 foundations.

**S-006: Interactive expressions** — `confirm()`, `prompt()`, `choose()` functions
that pause the daemon and return `prompt_user` actions. Responses stored as `vars`.

**S-007: Config validation** — branded `ValidConfig` type. Validates DAG acyclicity,
expression syntax, phase category references, skill references. Extends chain resolution.

**S-009: Machine generator** — workflow definition → XState v5 machine config at load
time. States map to steps, transitions governed by expression evaluation events.

**S-010: Step evaluation** — evaluate all steps against DB state via expressions.
Skip/block/done/needs resolution. Returns `StepEvaluation[]`.

**S-012: Issue CRUD** — create, update, close, archive, list with recursive parent/child
hierarchy. Issue type determines default workflow. Parent done when all children done.

**S-022: Projection adapter** — implements ProjectionPort. DB → filesystem markdown
rendering for open issues, active cycle, closed items, checkpoints, snapshot.

### Wave 3: Orchestration + Policies (Days 8–11)

**S-011: Atomic txNext** — the engine's core loop. Orchestrates evaluate → machine →
persist in a single PGLite transaction. No crash window between state changes.

**S-013: Deferrals** — create sibling issues with traceability metadata
(`deferred_from: { issue, step, cycle }`) and deferral notes linking to new issue.

**S-017: Policy engine** — expression-based policies for deferral, decision,
scope_change, issue_create. Evaluates to allow/require_approval/block.

**S-023: Skill/persona resolution** — npm install to `~/.twisted/projects/{id}/`,
package discovery, manifest generation, 3-layer merge (skill + manifest + config).

### Wave 4: Workflows + Daemon + Setup (Days 11–14)

**S-014: Issue workflow** — assign workflow by type, advance independently via
`tx next <issue>` without a cycle. Issues are first-class workflow participants.

**S-018: Daemon server** — PGLite owner, request queue, dirty tracking, batched flush
(immediate DB writes, batched projection), recovery (DB → snapshot → fresh).

**S-024: Guided setup** — conversational `tx init` flow. Asks about work style,
recommends workflow templates, suggests skill/persona packages, generates `.twisted.json`.

**S-025: Workflow migration** — `tx migrate` with declarative migration rules from
config. Agent-aided structural changes for renames, step removal, DAG reordering.

### Wave 5: Cycles + CLI (Days 14–17)

**S-015: Cycle lifecycle** — start, pull issues, close with retro + checkpoint.
One active cycle at a time. Pre-work on pulled issues skips satisfied steps.

**S-020: CLI** — thin socket client. All commands (issue, cycle, next, step, write,
read, note, config, status, install, handoff, pickup, resume). Human and JSON output.
No business logic — pure daemon request/response.

### Wave 6: Integration (Days 17–21)

**S-027: End-to-end tests** — full lifecycle flows:
1. `tx init` → `tx issue` → `tx next` → artifacts → `tx close`
2. `tx cycle` → `tx pull` → build → `tx close` → retro
3. Deferrals → backlog → new cycle
4. Checkpoint handoff/pickup
5. Workflow migration

---

## File Layout

```
src/
├── types/                    ← all type definitions
│   ├── issue.ts
│   ├── cycle.ts
│   ├── workflow.ts
│   ├── config.ts
│   ├── protocol.ts           ← DaemonRequest/Response/AgentResponse
│   ├── expressions.ts
│   └── index.ts              ← barrel
├── ports/                    ← interface definitions only
│   ├── storage.ts            ← shaped by PGLite API (see reference above)
│   ├── transport.ts
│   ├── projection.ts
│   ├── expression.ts
│   ├── packages.ts
│   └── index.ts
├── adapters/                 ← concrete implementations
│   ├── pglite/               ← StoragePort (in-memory mode for tests)
│   ├── socket/               ← TransportPort
│   ├── markdown/             ← ProjectionPort
│   └── npm/                  ← PackageResolverPort
├── engine/                   ← core workflow engine
│   ├── dag.ts
│   ├── generator.ts
│   ├── evaluate.ts
│   ├── state.ts              ← txNext()
│   ├── policies.ts
│   └── expressions/
│       ├── parser.ts
│       ├── evaluator.ts
│       ├── context.ts
│       └── functions.ts
├── issues/                   ← issue domain
│   ├── crud.ts
│   ├── hierarchy.ts
│   ├── deferrals.ts
│   └── workflow.ts
├── cycles/                   ← cycle domain
│   ├── lifecycle.ts
│   ├── pull.ts
│   └── retro.ts
├── checkpoints/
├── skills/
├── config/
├── daemon/
│   ├── server.ts
│   ├── queue.ts
│   ├── flush.ts
│   └── recovery.ts
├── cli/
│   ├── index.ts
│   ├── commands/
│   └── output.ts
└── __tests__/                ← all tests (not co-located with source files)
```

Note: no `adapters/memory/` directory — PGLite in-memory mode replaces the need for
a separate in-memory storage adapter.

## Risk Register

| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|------------|--------|
| PGLite transaction API mismatch | — | — | — | **Eliminated** — researched, callback-based with passable tx handle |
| PGLite JSONB limitations | — | — | — | **Eliminated** — full Postgres 17 JSONB |
| PGLite concurrent access surprises | — | — | — | **Eliminated** — mutex serialization, matches daemon |
| StoragePort interface churn | Low | High | Port shaped by real PGLite API, not speculation | **Mitigated** |
| Expression parser complexity | Medium | Medium | Start with subset grammar; expand incrementally; fuzz test | Open |
| Daemon socket reliability (Windows) | Medium | Medium | Named pipes on Windows; test cross-platform in Wave 1 | Open |
| XState v5 machine generation correctness | Low | High | Property-based tests: generated machine matches DAG invariants | Open |
| Scope creep | High | High | Strict scope doc adherence; defer to future issues | Open |
| 21-day timebox insufficient for XL | Medium | High | Waves 0–4 are critical path; Waves 5–6 can ship incrementally | Open |

## Critical Path

```
Wave 0: S-001 (types) + S-002 (ports)
  ↓
Wave 1: S-005 (expressions) ←── critical    S-008 (DAG) ←── critical
  ↓                                           ↓
Wave 2: S-010 (step eval) ←── critical       S-009 (machine gen) ←── critical
  ↓                                           ↓
Wave 3: S-011 (txNext) ←── BOTTLENECK ←──────┘
  ↓
Wave 4: S-014 (issue workflow) + S-018 (daemon)
  ↓
Wave 5: S-015 (cycles) + S-020 (CLI)
  ↓
Wave 6: S-027 (e2e tests)
```

S-011 (txNext) is the central bottleneck — two critical paths converge on it.
Everything downstream (daemon, CLI, cycles, e2e) waits for it.

## Definition of Done

- All commands from scope doc implemented and tested
- Engine advances issues/cycles through arbitrary workflow DAGs
- Expression system evaluates all documented context namespaces
- PGLite storage with atomic transactions (callback-based, passable tx handle)
- Daemon is the single path for all operations
- Projections render DB state to committed markdown
- Config validation catches all invalid states (branded ValidConfig)
- Skill/persona resolution via npm packages
- Checkpoint handoff/pickup bridges LLM sessions
- End-to-end lifecycle tests pass
- JSON schemas generated for all data types
