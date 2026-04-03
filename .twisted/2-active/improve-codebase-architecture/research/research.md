# Architecture Research: Module-Deepening Opportunities

> A **deep module** (Ousterhout, *A Philosophy of Software Design*) has a small
> interface hiding a large implementation. Deep modules are more testable, more
> AI-navigable, and let you test at the boundary instead of inside.

## Codebase Profile

| Area | Files | LOC | Test Coverage |
|------|-------|-----|---------------|
| Engine | 10 | ~910 | 58% (core tested, lanes untested) |
| CLI | 12 | ~1,380 | Integration only; 8 command modules untested |
| Types | 10 | ~380 | N/A (declarations) |
| Config | 4 | ~198 | Tested |
| Stories | 1 | 68 | Tested |
| Daemon | 3 | 257 | Untested |
| Agents | 1 | 80 | Tested |
| **Total** | **~44** | **~3,600** | **~58% modules covered** |

---

## Friction Map

### 1. txNext() God Function (engine/next.ts)

The 158-line `txNext()` orchestrates 7+ functions across 6 modules:
evaluate -> artifacts -> predicates -> lanes -> persist -> filesystem I/O.

**Problems:**
- Understanding "what happens when an epic advances" requires bouncing through 6 files
- Filesystem I/O (renameSync, mkdirSync) is interleaved with logic -- untestable without real FS
- Epic directory is moved *before* state is saved -- crash between = orphaned epic
- No rollback or transaction semantics

### 2. Shallow Evaluation Triad (engine/artifacts + predicates + evaluate)

Three modules totaling ~218 LOC pass data through shared types (`PredicateContext`,
`StepEvaluation[]`, `ArtifactRef[]`). Interface complexity rivals implementation:

- `activeStep()` and `laneComplete()` are 2-line filters exported as public API
- `PredicateContext` is threaded through 5 function signatures -- adding a field means 5 edits
- Predicate registry is hardcoded; unknown predicates silently return `false`

### 3. Copy-Paste Epic Location (engine/next + promote)

Both `txNext()` and `promoteEpic()` contain identical 8-line "scan all lanes for epic" loops.
Changing location discovery requires editing both. No shared helper exists.

### 4. Epic Resolution Boilerplate (CLI commands)

The pattern "resolve epic arg -> locate -> read state -> error if missing" appears ~27 times
across 8 command files. Never extracted. Changes to resolution logic require 27+ edits.

### 5. fs.ts God Module (cli/fs.ts)

259 LOC exporting 24+ functions with no internal cohesion -- a grab bag of CRUD:
`readCoreState`, `writeTasks`, `readNotes`, `writeActiveSession`, `locateEpic`, etc.
Contains v3/v4 migration remnants (`objectiveDir`, `readObjectives`).
No "load epic by name" composite -- callers always do locate + readState manually.

### 6. Shallow CliContext (cli/context.ts)

14-line interface with 7 methods, each hiding almost nothing:
- `findActiveEpic()` wraps `findEpics()` + `readCoreState()` + sort
- `ensureSession()` wraps read + conditional write
- `logAction()` wraps session mutation + write

Commands bypass context and call underlying fs functions directly anyway.

### 7. Orphaned XState Machine (engine/machine.ts + persist.ts)

The XState machine is **never called** by `txNext()` or any production code path.
Two parallel lifecycle models exist:
- **Functional model** (evaluate + lanes + next) -- actually used
- **State machine model** (machine + persist) -- decorative; snapshots written but never read

### 8. Daemon Type Duplication and Config Staleness

`DaemonRequest`/`DaemonResponse` interfaces are copy-pasted between server.ts and client.ts.
Daemon re-reads config on every request; CLI holds stale config from startup. They diverge.

### 9. No Config Validation

Config is merged but never validated. Invalid lane references, unknown predicate names,
and type sequences pointing to non-existent lanes are all silently accepted -- errors
surface deep in the engine at runtime.

### 10. CLI Command Side-Effect Soup

Each command action interleaves validation, I/O, business logic, session management,
and response formatting in a single callback. Untestable without spawning the full CLI.
Task ID allocation, session summary generation, and note type decoding are inline --
no unit tests exist for any of them.

---

## Test Coverage Gaps

| Module | Status | Risk |
|--------|--------|------|
| CLI commands (8 modules) | 0% unit coverage | HIGH -- primary user interface |
| engine/lanes.ts | 0% direct tests | HIGH -- core advancement logic |
| Daemon client/server | 0% | MEDIUM -- opt-in feature |
| Task ID allocation | Inline, untested | MEDIUM -- silent failure on malformed IDs |
| Session summary generation | Inline, untested | LOW -- formatting only |

---

## Deepening Candidates

### Candidate A: Step Evaluator (merge artifacts + predicates + evaluate)

- **Cluster:** engine/artifacts.ts (45 LOC) + engine/predicates.ts (76 LOC) + engine/evaluate.ts (97 LOC)
- **Why coupled:** Shared PredicateContext threaded through 5 functions; evaluate calls both artifacts and predicates; activeStep/laneComplete are trivial filters on shared StepEvaluation type
- **Dependency category:** In-process (pure computation + file-existence checks)
- **Test impact:** Existing engine-evaluate tests would become boundary tests on the merged module; internal artifact/predicate tests become implementation details

### Candidate B: Epic Locator (extract from next + promote + CLI)

- **Cluster:** engine/next.ts (epic scan loop), engine/promote.ts (identical loop), cli/fs.ts (locateEpic, findEpics), cli/commands/* (27x resolution boilerplate)
- **Why coupled:** All share the concept "find an epic across lanes" with copy-pasted implementations; CLI adds "resolve from arg/flag/active" on top
- **Dependency category:** In-process (filesystem scanning, no network)
- **Test impact:** Replace scattered location tests with single locator boundary tests; CLI commands become thinner (no inline resolution logic)

### Candidate C: State Transaction (extract from txNext)

- **Cluster:** engine/next.ts (state mutation + directory move), engine/persist.ts (snapshot I/O), cli/fs.ts (readCoreState/writeCoreState)
- **Why coupled:** txNext interleaves evaluation, directory moves, and state persistence in one function; no atomicity; crash between move and save = orphaned epic
- **Dependency category:** In-process (filesystem I/O, no network)
- **Test impact:** Can test state transitions without real filesystem; existing txNext integration tests become boundary tests for the transaction module

### Candidate D: Session Manager (consolidate session lifecycle)

- **Cluster:** cli/context.ts (ensureSession, logAction), cli/commands/session.ts (pickup, handoff, save, list), cli/fs.ts (readActiveSession, writeActiveSession, deleteActiveSession, listSessions)
- **Why coupled:** Session creation, logging, and finalization spread across 3+ files; context methods are thin wrappers; commands also call fs directly
- **Dependency category:** In-process (filesystem I/O)
- **Test impact:** Session summary generation and lifecycle invariants become testable at boundary; replace scattered session I/O tests

### Candidate E: Config Validator (new layer on config resolution)

- **Cluster:** config/resolve.ts (merge only), config/defaults.ts (monolithic 124-LOC object), engine/predicates.ts (hardcoded registry)
- **Why coupled:** Config references predicate names that must exist in registry; lane sequences reference lane dirs; step_skills reference step names -- none validated
- **Dependency category:** In-process (pure validation)
- **Test impact:** Add validation boundary tests; existing config-resolve tests stay; predicate tests gain config-aware assertions

### Candidate F: Machine Reconciliation (integrate or remove XState)

- **Cluster:** engine/machine.ts (87 LOC), engine/persist.ts (58 LOC)
- **Why coupled:** Machine defines transitions that duplicate the functional model in evaluate/lanes/next; persist saves snapshots nobody reads
- **Dependency category:** In-process
- **Test impact:** engine-machine.test.ts (6 tests) either becomes the primary lifecycle test suite or gets deleted entirely

---

## Shallow Module Summary

| Module | LOC | Interface Width | Depth | Verdict |
|--------|-----|----------------|-------|---------|
| engine/artifacts.ts | 45 | 3 exports | Shallow | Merge into evaluator |
| engine/predicates.ts | 76 | 3 exports + registry | Shallow | Merge into evaluator |
| engine/evaluate.ts | 97 | 3 exports | Shallow | Merge into evaluator |
| engine/machine.ts | 87 | XState machine | Decorative | Integrate or remove |
| engine/persist.ts | 58 | 2 exports | Dead | Depends on machine decision |
| cli/context.ts | 14 | 7-method interface | Shallow | Deepen with composed operations |
| cli/fs.ts | 259 | 24+ exports | Shallow | Split by domain |
| stories/stories.ts | 68 | 5 exports | Shallow | Acceptable (small scope) |
| config/merge.ts | 44 | 1 export | Shallow | Acceptable (utility) |
