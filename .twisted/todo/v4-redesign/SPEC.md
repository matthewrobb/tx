# twisted-workflow v4 Design Specification

**Status:** Draft
**Date:** 2026-04-01
**Replaces:** v3 architecture (see Migration Notes)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Naming Changes](#2-naming-changes)
3. [Lane Model](#3-lane-model)
4. [Epic Types and Pipelines](#4-epic-types-and-pipelines)
5. [Stories](#5-stories)
6. [Estimation Model](#6-estimation-model)
7. [Retrospective Loop](#7-retrospective-loop)
8. [Configuration Schema](#8-configuration-schema)
9. [Engine Algorithm](#9-engine-algorithm)
10. [Artifact-Driven Progress](#10-artifact-driven-progress)
11. [Task Commit References](#11-task-commit-references)
12. [Agent Rules and Files](#12-agent-rules-and-files)
13. [Daemon Architecture](#13-daemon-architecture)
14. [State Schema](#14-state-schema)
15. [Directory Structure](#15-directory-structure)
16. [CLI Reference](#16-cli-reference)
17. [Dependencies](#17-dependencies)
18. [Migration from v3](#18-migration-from-v3)
19. [Engine State Machine (XState)](#19-engine-state-machine-xstate)
20. [Deferred Work](#20-deferred-work)

---

## 1. Executive Summary

twisted-workflow v4 is a ground-up redesign of the orchestration layer built on three insights gained from v3:

**Insight 1 — Artifact existence is the only reliable progress signal.** Boolean flags in state.json drift and require coordination. Files either exist or they don't. The v4 engine treats artifact existence (and predicate queries on artifact content) as the sole source of truth for step completion.

**Insight 2 — The pipeline should be data, not code.** v3 hardcoded step sequences and type-specific logic in TypeScript. v4 externalizes the entire pipeline into `settings.json`: which lanes exist, which steps run per lane, which artifacts each step requires and produces, and which types pass through which lanes. The TypeScript engine becomes a generic interpreter of this config.

**Insight 3 — The work model needs a third tier.** v3 had epics and tasks. v4 adds stories between them: epics contain stories (user-facing value units), stories contain tasks (technical implementation units). This maps cleanly onto how product and engineering actually divide work.

Additional v4 changes:

- "objective" renamed to "epic" throughout
- Lanes are ordered, numerically prefixed, and filesystem-mirrored
- Five epic types with type-specific pipelines: feature, technical, bug, spike, chore
- Spike promotion: a concluded spike can become a new epic, carrying its artifacts forward
- Two-dimension estimation: story points (value/uncertainty) and effort (technical complexity)
- Retrospective loop: retro notes written per task, aggregated at close, parsed for backlog candidates that feed the next cycle
- Daemon architecture with `sock-daemon` for process lifecycle management
- Runtime drops Bun as a requirement; Node.js / npm only
- Dead config cleaned up (see Migration Notes)

A developer or agent with this document and the v3 source can implement v4 from scratch without needing the conversation history that produced this spec.

---

## 2. Naming Changes

| v3 | v4 |
|---|---|
| objective | epic |
| `-o` / `--objective` flag | `-e` / `--epic` flag |
| `tx open <objective>` | `tx open <epic>` |
| `tx resume <objective>` | `tx resume <epic>` |
| `tx close <objective>` | `tx close <epic>` |
| `.twisted/{lane}/{objective}/` | `.twisted/{lane}/{epic}/` |
| `state.json: { name, step, ... }` | `state.json: { name, type, lane, step, ... }` |

All user-facing strings, help text, error messages, and documentation use "epic". The word "objective" does not appear in v4.

---

## 3. Lane Model

### 3.1 Default Lanes

Lanes are ordered and named with a numeric prefix so they sort correctly in filesystem listings:

| Lane | Name | Meaning |
|---|---|---|
| `0-backlog` | Backlog | Identified, not yet committed |
| `1-ready` | Ready | Groomed, could start today |
| `2-scoped` | Scoped | Research + scope complete, stories defined |
| `3-started` | Started | Plan exists, tasks assigned, execution underway |
| `4-done` | Done | Shipped, retro written |
| `5-archived` | Archived | Abandoned, deprecated, dead-ended |

For features and technical epics, "ready" means research is done. For spikes, "ready" means a question and hypothesis exist.

### 3.2 Lane Advancement Rules

Lane advancement is **automatic** as a side effect of `tx next`. When all steps in the current lane are complete (all required artifacts exist), `tx next` advances the epic to the next lane defined for its type.

Two exceptions require explicit human decision:

1. **`0-backlog` → `1-ready`**: Cannot happen automatically. A human must explicitly commit to working on the epic. Command: `tx ready <epic>`.
2. **`any` → `5-archived`**: Cannot happen automatically. Command: `tx archive <epic> --reason <text>`.

### 3.3 The `5-archived` Lane

Archived epics carry a `disposition` field in `state.json`:

| Disposition | Meaning |
|---|---|
| `abandoned` | Stopped mid-flight, not worth continuing |
| `deprecated` | Superseded by a different approach |
| `promoted` | Spike concluded, spawned a new epic |

---

## 4. Epic Types and Pipelines

### 4.1 Type Definitions

Each type has a distinct pipeline — the ordered subset of lanes it passes through — and different field requirements.

#### `feature`

Full pipeline: `0-backlog → 1-ready → 2-scoped → 3-started → 4-done`

- Has stories with acceptance criteria
- Has story points (Fibonacci) + effort estimation (T-shirt)
- Stories decomposed during `2-scoped`

#### `technical`

Full pipeline: `0-backlog → 1-ready → 2-scoped → 3-started → 4-done`

- No stories
- Has acceptance criteria
- Effort estimation only (no story points)

#### `bug`

Abbreviated pipeline: `0-backlog → 1-ready → 3-started → 4-done`

- No stories
- Has repro steps (replaces acceptance criteria)
- Effort estimation only
- Skips `2-scoped` — bugs don't need a scope phase

#### `spike`

Research pipeline: `0-backlog → 1-ready → 3-started → 4-done → 5-archived`

- Research IS the execution
- Has `timebox` instead of story points / effort
- Has `findings.md` and `decision.md` artifacts instead of `plan.md`
- Outcome: promoted (→ new epic) or archived
- See Section 4.2 for spike promotion

#### `chore`

Minimal pipeline: `0-backlog → 1-ready → 3-started → 4-done`

- No stories
- No estimation
- No acceptance criteria
- Example: dependency upgrades, CI maintenance, repo cleanup

### 4.2 Spike Promotion

When a spike concludes with an actionable outcome, it is promoted to a substantive epic type.

**Preferred approach — mutate in place:**

1. `tx promote <spike-name> --type feature` (or `technical`)
2. Engine writes `disposition: "promoted"` to spike's `state.json`
3. Engine changes `type` from `spike` to the target type in `state.json`
4. Engine advances `lane` and `step` pointers past already-completed steps
5. Research and findings artifacts from the spike are carried forward
6. Artifact-driven skip logic (Section 10) automatically skips steps whose artifacts already exist

**Result:** The spike directory becomes the epic directory. No new directory is created, no artifacts are copied. The engine's skip logic handles the rest.

**`promoted_to` field:** If a separate epic is created instead (edge case), `state.json` records `promoted_to: "<epic-name>"`.

---

## 5. Stories

### 5.1 Overview

Stories are a new tier between epic and task:

```
epic
  └── story (user-facing value unit)
        └── task (technical implementation unit)
```

Stories are written from the user's perspective: "As a [user type], I want [capability] so that [benefit]."

Stories have acceptance criteria. Tasks have implementation steps.

Stories apply to `feature` and `technical` types only. `bug`, `spike`, and `chore` epics have tasks directly.

### 5.2 `stories.json` Schema

```typescript
interface Story {
  id: string                    // e.g. "S-001"
  summary: string               // user story sentence
  acceptance_criteria: string[] // list of verifiable conditions
  status: "pending" | "in_progress" | "done"
  story_points?: number | null  // Fibonacci, features only
  tasks: string[]               // task IDs belonging to this story
  created: string               // ISO-8601
  updated: string               // ISO-8601
}

type StoriesFile = Story[]
```

### 5.3 Story Decomposition

Stories are produced during the `decompose` step in `2-scoped`. The `decompose` step produces both `stories.json` and `tasks.json`. Tasks reference their parent story by ID.

---

## 6. Estimation Model

### 6.1 Two-Dimension Estimation

| Field | Scale | Applies To | Meaning |
|---|---|---|---|
| `story_points` | Fibonacci: 1, 2, 3, 5, 8, 13 | `feature` only | User value + uncertainty |
| `effort` | XS / S / M / L / XL | `feature`, `technical`, `bug` | Technical complexity |
| `timebox` | minutes (integer) | `spike` only | Fixed time budget |
| `confidence` | low / medium / high | all types | Confidence in estimate |
| `poker_session` | string path | optional | Path to planning poker session file |

`story_points` and `effort` are independent axes. A small story (1 SP) can be high effort (L) if it is technically tricky but has low uncertainty. A large story (13 SP) can be low effort (XS) if it is well understood but has wide scope.

### 6.2 Estimation Timing

Estimation happens during the `1-ready` → `2-scoped` transition — specifically in the `estimate` step within the `1-ready` lane — **before** plan generation. It does not happen during the plan step.

The `estimate` step produces `estimate.json`.

### 6.3 `estimate.json` Schema

```typescript
interface EstimateFile {
  story_points?: number | null   // null if not applicable
  effort?: "XS" | "S" | "M" | "L" | "XL" | null
  timebox?: number | null        // minutes; spikes only
  confidence: "low" | "medium" | "high"
  poker_session?: string         // relative path to session file
  rationale?: string             // free-form explanation
  estimated_at: string           // ISO-8601
}
```

---

## 7. Retrospective Loop

### 7.1 Overview

The retro loop closes the cycle from execution back to backlog. It operates at two levels:

1. **Task level** — each task agent writes a retro note as it finishes
2. **Epic level** — at `tx close`, all retro notes are aggregated into `retro.md`

### 7.2 `retro` Note Type

The `notes.json` format gains a new note type `retro` with structured fields:

```typescript
interface RetroNote {
  type: "retro"
  task_id: string
  good: string[]       // what went well
  bad: string[]        // what was painful
  ugly: string[]       // what was broken or wrong
  suggestions: string[] // actionable improvements
  created: string       // ISO-8601
}
```

The existing note types (`decision`, `deferral`, `discovery`, `blocker`) are unchanged.

### 7.3 Epic Close Flow

At `tx close`:

1. All `retro` notes are collected from `notes.json`
2. Aggregated and written to `retro.md`
3. `retro.md` is parsed for backlog candidates — items in `suggestions` that describe new work
4. Backlog candidates become notes with `type: "backlog_candidate"`:
   ```typescript
   interface BacklogCandidateNote {
     type: "backlog_candidate"
     summary: string
     source_epic: string
     source_task_id: string
     created: string
   }
   ```
5. A human triages backlog candidates and promotes them to new `0-backlog` epics
6. Command: `tx backlog promote <note-id> --type feature --name <epic-name>`

### 7.4 Loop Closure

```
execution → retro notes → retro.md → backlog candidates → new epics → execution
```

This is the intended feedback loop. Nothing about it is automatic beyond step 4 — human triage is intentional.

---

## 8. Configuration Schema

### 8.1 Philosophy

The v4 config is an **open pipeline description**, not a closed enumeration. The engine is a generic interpreter; all domain logic lives in config. This means:

- New epic types can be added without code changes
- New lanes can be added without code changes
- New steps can be added without code changes
- Built-in presets (twisted, superpowers, minimal) are just well-tested configs

The three-layer override system from v3 is preserved:

```
deepMerge(defaults, ...presets.reverse().map(load), projectSettings ?? {})
```

First preset wins — put the most important one first.

### 8.2 TypeScript Interfaces

```typescript
// Top-level settings.json shape
interface Settings {
  version: 4
  presets?: string[]
  lanes: Record<string, LaneConfig>
  steps: Record<string, StepConfig>
  types: Record<string, TypeConfig>
  estimation?: EstimationConfig
  commit?: CommitConfig
  daemon?: DaemonConfig
  metadata?: Record<string, unknown>
}

// A lane definition
interface LaneConfig {
  label?: string                    // human display name
  entry_requires?: ArtifactRef[]    // artifacts that must exist to enter this lane
  steps: LaneStep[]                 // ordered steps in this lane
}

// A step as declared inside a lane (references top-level step by name)
interface LaneStep {
  step: string                      // key in Settings.steps
  requires: ArtifactRef[]           // artifacts required before this step runs
}

// Top-level step definition (pure skill descriptor — no deps, no lane knowledge)
interface StepConfig {
  skill: "built-in" | string        // "built-in" or path to external skill
  produces: string[]                // artifact paths this step writes
  description?: string              // human-readable
}

// Artifact reference — either a plain path or a predicate rule
type ArtifactRef = string | PredicateRef

interface PredicateRef {
  file: string                      // artifact path
  where: BuiltinPredicate | string  // built-in name or custom expression
}

type BuiltinPredicate =
  | "tasks.all_done"
  | "tasks.any_done"
  | "tasks.none_done"
  | "tasks.any_committed"
  | "tasks.all_committed"
  | `tasks.count >= ${number}`

// Epic type definition
interface TypeConfig {
  lanes: string[]                   // ordered lane names this type passes through
  description?: string
}

// Estimation constraints (informational — enforced by skills, not engine)
interface EstimationConfig {
  story_points_scale: number[]      // default: [1, 2, 3, 5, 8, 13]
  effort_scale: string[]            // default: ["XS", "S", "M", "L", "XL"]
  confidence_scale: string[]        // default: ["low", "medium", "high"]
}

// Commit message format
interface CommitConfig {
  message_format: string            // default: "({epic}#{task}): {message}"
  enforce_hook: boolean             // whether tx init installs commit-msg hook
}

// Daemon settings
interface DaemonConfig {
  idle_timeout_ms: number           // default: 300000 (5 minutes)
  socket_name: string               // default: "twisted-daemon"
}
```

### 8.3 Example `settings.json`

This is the default built-in configuration. Project settings override individual keys.

```json
{
  "version": 4,
  "presets": [],

  "steps": {
    "research":  { "skill": "built-in", "produces": ["research/001.md"] },
    "scope":     { "skill": "built-in", "produces": ["scope.md"] },
    "estimate":  { "skill": "built-in", "produces": ["estimate.json"] },
    "decompose": { "skill": "built-in", "produces": ["tasks.json", "stories.json"] },
    "plan":      { "skill": "built-in", "produces": ["plan.md"] },
    "build":     { "skill": "built-in", "produces": [] },
    "retro":     { "skill": "built-in", "produces": ["retro.md"] },
    "findings":  { "skill": "built-in", "produces": ["findings.md"] },
    "decision":  { "skill": "built-in", "produces": ["decision.md"] }
  },

  "lanes": {
    "0-backlog": {
      "label": "Backlog",
      "steps": []
    },
    "1-ready": {
      "label": "Ready",
      "steps": [
        { "step": "research", "requires": [] },
        { "step": "estimate", "requires": ["research/001.md"] }
      ]
    },
    "2-scoped": {
      "label": "Scoped",
      "entry_requires": ["research/001.md", "estimate.json"],
      "steps": [
        { "step": "scope",     "requires": ["research/001.md"] },
        { "step": "decompose", "requires": ["scope.md"] }
      ]
    },
    "3-started": {
      "label": "Started",
      "entry_requires": ["scope.md", "tasks.json"],
      "steps": [
        { "step": "plan",  "requires": ["tasks.json"] },
        { "step": "build", "requires": ["plan.md"] }
      ]
    },
    "4-done": {
      "label": "Done",
      "entry_requires": [
        { "file": "tasks.json", "where": "tasks.all_done" }
      ],
      "steps": [
        { "step": "retro", "requires": [
          { "file": "tasks.json", "where": "tasks.all_done" }
        ]}
      ]
    },
    "5-archived": {
      "label": "Archived",
      "steps": []
    }
  },

  "types": {
    "feature": {
      "lanes": ["0-backlog", "1-ready", "2-scoped", "3-started", "4-done"],
      "description": "User-facing feature with stories and full estimation"
    },
    "technical": {
      "lanes": ["0-backlog", "1-ready", "2-scoped", "3-started", "4-done"],
      "description": "Internal technical work, no stories, effort only"
    },
    "bug": {
      "lanes": ["0-backlog", "1-ready", "3-started", "4-done"],
      "description": "Defect repair, abbreviated pipeline"
    },
    "spike": {
      "lanes": ["0-backlog", "1-ready", "3-started", "4-done", "5-archived"],
      "description": "Time-boxed research with promote-or-archive outcome"
    },
    "chore": {
      "lanes": ["0-backlog", "1-ready", "3-started", "4-done"],
      "description": "Maintenance work, no estimation required"
    }
  },

  "estimation": {
    "story_points_scale": [1, 2, 3, 5, 8, 13],
    "effort_scale": ["XS", "S", "M", "L", "XL"],
    "confidence_scale": ["low", "medium", "high"]
  },

  "commit": {
    "message_format": "({epic}#{task}): {message}",
    "enforce_hook": true
  },

  "daemon": {
    "idle_timeout_ms": 300000,
    "socket_name": "twisted-daemon"
  }
}
```

### 8.4 Spike Override Example

A project that wants spikes to use `findings` and `decision` steps instead of the default `3-started` steps:

```json
{
  "version": 4,
  "lanes": {
    "3-started": {
      "steps": [
        { "step": "findings", "requires": [] },
        { "step": "decision", "requires": ["findings.md"] },
        { "step": "build",    "requires": ["decision.md"] }
      ]
    }
  }
}
```

Because config uses `deepMerge`, this overrides only the `3-started.steps` array — all other lanes and types remain unchanged.

Note: `deepMerge` replaces arrays wholesale (no array merging). To customize a lane's steps, supply the full steps array for that lane.

---

## 9. Engine Algorithm

### 9.1 Overview

The engine is a pure function: given `(epicDir, config)`, it determines the current state and what to do next. All mutations are explicit writes to the filesystem.

### 9.2 Core Types (Engine-Internal)

```typescript
type StepStatus = "done" | "runnable" | "blocked" | "skipped"

interface StepEvaluation {
  step: string
  status: StepStatus
  missing_requires: ArtifactRef[]  // empty if status is "done" or "runnable"
}

interface EngineState {
  epic: string
  type: string
  lane: string
  step: string
  evaluations: StepEvaluation[]    // all steps in current lane
  next_step: string | null         // first runnable step, or null
  next_lane: string | null         // set when all steps done and lane can advance
  can_advance_lane: boolean
}
```

### 9.3 `tx next` Algorithm

```
function txNext(epicName, config):

  // 1. Load state
  state = readStateJson(epicDir(epicName))
  typeConfig = config.types[state.type]
  laneConfig = config.lanes[state.lane]

  // 2. Evaluate all steps in current lane
  evaluations = []
  for step in laneConfig.steps:
    missing = []
    for req in step.requires:
      if not artifactSatisfied(epicDir, req):
        missing.push(req)
    if missing.length == 0:
      // All requires satisfied — check if produces already exist
      allProduced = config.steps[step.step].produces.every(p => exists(epicDir / p))
      status = allProduced ? "done" : "runnable"
    else:
      status = "blocked"
    evaluations.push({ step: step.step, status, missing_requires: missing })

  // 3. Find the first runnable step (respects ordering)
  nextStep = evaluations.find(e => e.status == "runnable")

  // 4. If a runnable step exists, run it
  if nextStep:
    runSkill(config.steps[nextStep.step].skill, epicDir, nextStep.step)
    // Skill writes artifacts to epicDir; engine does not write them
    state.step = nextStep.step
    state.updated = now()
    writeStateJson(epicDir, state)
    return

  // 5. If no runnable step, check if all steps are done
  allDone = evaluations.every(e => e.status == "done")
  if not allDone:
    blocked = evaluations.filter(e => e.status == "blocked")
    reportBlocked(blocked)
    return

  // 6. All steps done — check if lane can advance
  currentLaneIndex = typeConfig.lanes.indexOf(state.lane)
  nextLaneName = typeConfig.lanes[currentLaneIndex + 1] ?? null
  if not nextLaneName:
    // Already in terminal lane
    reportComplete(epicName)
    return

  nextLaneConfig = config.lanes[nextLaneName]
  entryMissing = (nextLaneConfig.entry_requires ?? []).filter(r =>
    not artifactSatisfied(epicDir, r)
  )

  if entryMissing.length > 0:
    // Entry requirements for next lane not met
    reportEntryBlocked(nextLaneName, entryMissing)
    return

  // 7. Advance lane
  oldLane = state.lane
  state.lane = nextLaneName
  state.step = firstStepOf(nextLaneConfig) ?? ""
  state.updated = now()

  // Move directory
  moveDir(
    ".twisted" / oldLane / epicName,
    ".twisted" / nextLaneName / epicName
  )
  writeStateJson(newEpicDir, state)
  reportLaneAdvance(epicName, oldLane, nextLaneName)

  // 8. Recurse: immediately evaluate next lane
  //    This handles lanes with no steps (0-backlog, 5-archived)
  //    and auto-skips steps whose artifacts already exist (promoted spikes)
  txNext(epicName, config)
```

### 9.4 `artifactSatisfied` Algorithm

```
function artifactSatisfied(epicDir, ref):

  // Plain string: file existence check
  if typeof ref == "string":
    return exists(epicDir / ref)

  // Predicate ref: file must exist AND predicate must hold
  if not exists(epicDir / ref.file):
    return false

  return evaluatePredicate(epicDir / ref.file, ref.where)

function evaluatePredicate(filePath, predicate):
  data = readJson(filePath)

  switch predicate:
    case "tasks.all_done":
      return data.every(t => t.done == true)
    case "tasks.any_done":
      return data.some(t => t.done == true)
    case "tasks.none_done":
      return data.every(t => t.done != true)
    case "tasks.any_committed":
      return data.some(t => t.commit != null)
    case "tasks.all_committed":
      return data.filter(t => t.done).every(t => t.commit != null)
    default:
      // "tasks.count >= N" pattern
      match = predicate.match(/^tasks\.count >= (\d+)$/)
      if match:
        return data.length >= parseInt(match[1])
      // Unknown predicate — log warning, return false
      warn("Unknown predicate: " + predicate)
      return false
```

### 9.5 `tx promote` Algorithm (Spike Promotion)

```
function txPromote(spikeName, targetType, config):

  state = readStateJson(epicDir(spikeName))
  assert state.type == "spike", "Only spikes can be promoted"

  // Mark spike as promoted
  state.disposition = "promoted"
  state.type = targetType
  state.updated = now()

  // Find which lane to place the promoted epic in.
  // Scan targetType.lanes in order; find the first lane whose
  // entry_requires are NOT all satisfied. Place epic in the lane before it.
  typeConfig = config.types[targetType]
  targetLane = typeConfig.lanes[0]
  for laneName in typeConfig.lanes:
    laneConfig = config.lanes[laneName]
    entryMet = (laneConfig.entry_requires ?? []).every(r =>
      artifactSatisfied(epicDir(spikeName), r)
    )
    if entryMet:
      targetLane = laneName
    else:
      break

  // Move directory if lane changed
  oldLane = state.lane
  if oldLane != targetLane:
    moveDir(
      ".twisted" / oldLane / spikeName,
      ".twisted" / targetLane / spikeName
    )

  state.lane = targetLane
  state.step = firstIncompleteStep(targetLane, spikeName, config) ?? ""
  writeStateJson(newEpicDir(spikeName), state)

  report("Promoted " + spikeName + " to " + targetType + " in " + targetLane)
  report("Existing artifacts carried forward — engine will auto-skip completed steps")
```

---

## 10. Artifact-Driven Progress

### 10.1 Principle

Artifact existence is the **only** progress signal in v4. There are no boolean completion flags in `state.json` (no `research_done: true`, no `scoped: true`). The engine derives all progress from what files exist on disk.

Consequences:

- Progress is always recoverable from the filesystem alone, without trusting `state.json`
- Corrupted or out-of-sync state can be repaired by deleting or creating artifact files
- Skills can be re-run to regenerate artifacts without updating state
- Promoted spikes automatically get credit for artifacts that already exist

### 10.2 Build Completion Signal

There is no separate `build.json` artifact. `tasks.json` is the build signal.

The `4-done` lane's `entry_requires` uses a predicate rule:

```json
{ "file": "tasks.json", "where": "tasks.all_done" }
```

When every task has `done: true`, the engine considers the build step complete and will attempt to advance to `4-done`.

For projects that also require commit traceability, `entry_requires` can additionally include:

```json
{ "file": "tasks.json", "where": "tasks.all_committed" }
```

### 10.3 Artifact Path Resolution

All artifact paths in `produces` and `requires` are **relative to the epic directory** (i.e., relative to `.twisted/{lane}/{epic}/`).

Paths with subdirectories are supported: `research/001.md`, `sessions/active.json`.

---

## 11. Task Commit References

### 11.1 `tx commit` Command

`tx commit "<message>"` is the **only** supported way to create git commits in a twisted-workflow project. It:

1. Reads the active session and current task from context
2. Formats the commit message as `({epic}#{task}): {message}` (configurable via `commit.message_format`)
3. Runs `git commit -m "<formatted message>"`
4. Reads the resulting commit hash (short, 7 chars)
5. Writes the hash back to `tasks.json` for the active task: `"commit": "abc1234"`

### 11.2 Commit Message Format

Default: `({epic}#{task}): {message}`

Template variables:

| Variable | Resolves to |
|---|---|
| `{epic}` | Epic name |
| `{task}` | Task ID (e.g., `T-003`) |
| `{message}` | User-supplied message |
| `{lane}` | Current lane name |
| `{type}` | Epic type |

Custom format example (Jira-style):

```json
{ "commit": { "message_format": "[{epic}] {message} (task:{task})" } }
```

### 11.3 Git Hook

`tx init` installs a `commit-msg` git hook that rejects bare `git commit` invocations (i.e., commits whose message does not match the configured format). This is a hard backstop that enforces `tx commit` even when developers use the git CLI directly.

The hook is installed at `.git/hooks/commit-msg`. If the hook already exists, `tx init` appends a check rather than replacing it.

### 11.4 Escape Hatches

For commits that are legitimately outside the epic/task model (initial setup, documentation, dependency updates):

```
tx commit "<message>" --no-task
```

This bypasses task tracking and format enforcement. It creates a plain `git commit`. The hook recognizes commits made via `tx commit --no-task` by a special prefix (`[no-task]` prepended by default, configurable).

For commits to a specific task that is not the current active task:

```
tx commit "<message>" --task T-007
```

### 11.5 `tasks.json` Task Schema (v4)

```typescript
interface Task {
  id: string              // e.g. "T-001"
  summary: string
  story_id?: string       // parent story ID, if applicable
  done: boolean
  commit?: string         // short commit hash, written by tx commit
  created: string         // ISO-8601
  updated: string         // ISO-8601
  notes?: string          // free-form
}
```

---

## 12. Agent Rules and Files

### 12.1 Agent File Location

Agent files live in `.twisted/agents/` and are symlinked into Claude Code's agents directory:

```
.claude/agents/twisted/ → symlink → ../../.twisted/agents/
```

The symlink is created by `tx init` using the `symlink-dir` package (cross-platform: real symlink on Unix, directory junction on Windows).

### 12.2 Agent Files

Each file defines the rules for a specific role:

| File | Role | Capabilities |
|---|---|---|
| `build.md` | Build agent | Read/write everything; `tx commit` only; update tasks via `tx tasks update` |
| `planning.md` | Planning agent | Read-only; estimate only; no commits; no task writes |
| `retro.md` | Retro agent | Read-only + write `retro.md` only |
| `review.md` | Review agent | Read-only + write notes only (via `tx note`) |
| `research.md` | Research agent | Read-only + write research artifacts |

### 12.3 Universal Hard Rules (in project CLAUDE.md)

These rules apply to all agents and are placed in the project-root `CLAUDE.md`:

```
NEVER run `git commit` directly — always use `tx commit`
NEVER edit tasks.json, state.json, notes.json directly — use tx commands
Start sessions with `tx pickup <name>`, end with `tx handoff <name>`
```

### 12.4 Agent Files as Build Artifacts

Agent files are **generated** by `bun run build` from config and presets. They are committed to the repository. Developers do not edit them directly — they edit config or presets, then regenerate.

The build script reads:
- `settings.json` (resolved with presets)
- Agent role templates from `build/agents/`
- Injects commit format, task rules, and any custom steps into the agent files

---

## 13. Daemon Architecture

### 13.1 Overview

v4 introduces an optional daemon process for state coordination. The daemon eliminates race conditions when multiple `tx` commands run in parallel (e.g., parallel build agents), and amortizes startup cost for high-frequency `tx` invocations.

The daemon is **on-demand**: it spins up when first needed and self-terminates after an idle timeout. It is not attached to any shell session and persists across terminal closes.

### 13.2 Daemon Lifecycle

```
tx command invoked
  → check for daemon socket (OS socket file in tempdir)
  → if socket exists: connect and execute
  → if socket does not exist: spawn daemon, wait for ready, connect and execute
  → daemon executes command against filesystem
  → daemon returns result
  → if idle for idle_timeout_ms: daemon self-terminates
```

### 13.3 Scope

One daemon per machine (not per project). The daemon is project-aware and routes commands by project root (resolved from cwd).

### 13.4 `server.json`

The daemon writes `server.json` to the `.twisted/` directory on startup:

```json
{
  "pid": 12345,
  "started": "2026-04-01T10:00:00.000Z",
  "idle_timeout_ms": 300000
}
```

Stale detection: if the PID in `server.json` is not alive, delete `server.json` and respawn.

### 13.5 Fallback

If the daemon cannot be started (permissions, port conflict, unsupported environment), `tx` falls back to direct filesystem access with `proper-lockfile` for serialization. The fallback is transparent to the user.

### 13.6 Implementation Package

`sock-daemon` by isaacs handles the daemon process lifecycle: socket management, spawn-on-demand, PID tracking, and graceful shutdown. See Section 17 for version and rationale.

---

## 14. State Schema

### 14.1 `CoreState` (v4)

```typescript
interface CoreState {
  name: string
  type: "feature" | "technical" | "bug" | "spike" | "chore"
  lane: string              // current lane name, e.g. "3-started"
  step: string              // current step name, e.g. "build"
  created: string           // ISO-8601
  updated: string           // ISO-8601
  disposition?: "promoted" | "abandoned" | "deprecated"
  promoted_to?: string      // epic name, if spike was promoted to a new epic
  estimate?: {
    story_points?: number | null   // Fibonacci; features only
    effort?: "XS" | "S" | "M" | "L" | "XL" | null
    timebox?: number | null        // minutes; spikes only
    confidence?: "low" | "medium" | "high"
    poker_session?: string         // relative path to session file
  }
  metadata: Record<string, unknown>  // extensible, not used by engine
}
```

### 14.2 Notes on State Fields

- `lane` is the filesystem truth — the engine always verifies it matches the actual directory location. If they diverge, the directory wins.
- `step` is informational. The engine derives the current runnable step from artifact existence, not from this field. `step` is written after each `tx next` for human readability.
- `disposition` is only set when the epic enters `5-archived` or is promoted from a spike.
- `promoted_to` is only set if promotion created a new directory (edge case — see Section 4.2).
- `metadata` is a bag for project-specific fields. The engine never reads it.

---

## 15. Directory Structure

### 15.1 `.twisted/`

```
.twisted/
  settings.json                  ← project config (sparse override)
  agents/                        ← generated agent files
    build.md
    planning.md
    retro.md
    review.md
    research.md
  0-backlog/
    {epic-name}/
      state.json
  1-ready/
    {epic-name}/
      state.json
      research/
        001.md
      estimate.json
  2-scoped/
    {epic-name}/
      state.json
      research/
      scope.md
      estimate.json
      stories.json
      tasks.json
  3-started/
    {epic-name}/
      state.json
      tasks.json
      stories.json               ← if feature/technical
      notes.json
      estimate.json
      research/
      scope.md
      plan.md
      sessions/
        active.json
        001-session-name.md
  4-done/
    {epic-name}/
      state.json
      tasks.json
      stories.json
      notes.json
      estimate.json
      research/
      scope.md
      plan.md
      retro.md
      sessions/
  5-archived/
    {epic-name}/
      state.json
      ... (all artifacts from before archival)
```

### 15.2 `.claude/`

```
.claude/
  agents/
    twisted/                     ← symlink → ../../.twisted/agents/
  CLAUDE.md                      ← universal hard rules (or in project root)
```

### 15.3 Project Root

```
project-root/
  CLAUDE.md                      ← universal hard rules (if not in .claude/)
  .twisted/
  .claude/
  .git/
    hooks/
      commit-msg                 ← installed by tx init
```

---

## 16. CLI Reference

### 16.1 Command Summary

```
tx init                           — setup .twisted/, install git hook, create agents symlink
tx open <epic> --type <type>      — create epic in 0-backlog
tx close [epic]                   — run retro step, finalize, advance to 4-done
tx next [epic]                    — advance active epic one step (auto-advances lane)
tx resume <epic>                  — set named epic as active
tx status [epic]                  — show all epics or one epic
tx ready <epic>                   — move epic from 0-backlog to 1-ready (requires human decision)
tx archive <epic> --reason <text> — move epic to 5-archived (requires human decision)
tx promote <epic> --type <type>   — promote spike to new type, carry artifacts forward

tx research [epic]                — run research step
tx scope [epic]                   — run scope step
tx plan [epic]                    — run plan step
tx build [epic]                   — run build step
tx estimate [epic]                — run estimate step

tx pickup [name]                  — start a session
tx handoff [name]                 — end a session
tx session status|save|list       — manage sessions

tx write <type> [epic]            — write artifact (from stdin)
tx read <type> [epic]             — read artifact (to stdout)
tx artifacts [epic]               — list artifacts

tx tasks [epic]                   — list tasks
tx tasks add <summary>            — add a task
tx tasks update <id>              — update a task
tx tasks show <id>                — show task detail

tx stories [epic]                 — list stories
tx stories add <summary>          — add a story
tx stories update <id>            — update a story

tx note <summary>                 — add a note
tx notes [epic]                   — query notes

tx commit "<message>"             — commit via tx (writes hash to tasks.json)
tx commit "<message>" --task <id> — commit against specific task
tx commit "<message>" --no-task   — commit outside task context

tx backlog promote <note-id> --type <type> --name <name>  — promote backlog candidate to new epic

tx config [section] [sub]         — show resolved config
```

### 16.2 Flags

```
-e, --epic <name>    target a specific epic (replaces -o / --objective)
-a, --agent          JSON output (for agent use)
-y, --yolo           skip confirmations
--type <type>        epic type: feature | technical | bug | spike | chore
--reason <text>      reason for archive
--task <id>          explicit task ID for tx commit
--no-task            bypass task tracking for tx commit
```

### 16.3 Agent Output Mode

All commands support `-a` / `--agent` for machine-readable JSON output. The JSON envelope is:

```typescript
interface AgentResponse {
  ok: boolean
  command: string
  epic?: string
  data?: unknown
  error?: string
  warnings?: string[]
}
```

---

## 17. Dependencies

### 17.1 Runtime Dependencies

| Package | Version | Rationale |
|---|---|---|
| `sock-daemon` | `^1.x` | On-demand daemon lifecycle, socket management, PID tracking. By isaacs. Avoids rolling a daemon from scratch. |
| `fs-extra` | `^11.x` | Filesystem operations with sane defaults: `ensureDir`, `move`, `outputJson`, `readJson`. Replaces ad-hoc `mkdirSync`/`writeFileSync` patterns from v3. |
| `symlink-dir` | `^6.x` | Cross-platform symlink/junction. Real symlink on Unix; directory junction on Windows (where unprivileged symlinks are unreliable). Used for `.claude/agents/twisted/` → `.twisted/agents/`. |
| `proper-lockfile` | `^4.x` | File-based locking for the no-daemon fallback path. Prevents concurrent writes to `tasks.json`, `state.json`, etc. when no daemon is running. |

### 17.2 Development Dependencies

| Package | Version | Rationale |
|---|---|---|
| `typescript` | `^5.x` | Source language. |
| `vitest` | `^1.x` | Test runner. Replaces Bun's built-in test runner; node:test is also acceptable but vitest has better DX for the test suite style used in v3. Final choice: TBD before implementation begins. |
| `@types/node` | `^20.x` | Node.js type definitions. |
| `@types/fs-extra` | `^11.x` | fs-extra types. |

### 17.3 Runtime Environment

| Requirement | v3 | v4 |
|---|---|---|
| Runtime | Bun | Node.js >= 20 |
| Package manager | bun | npm |
| Build | `bun run build` | `npm run build` |
| Test | `bun test` | `npm test` |

Bun is dropped as a runtime requirement. The primary motivation is reducing the barrier to entry: Node.js is universal; Bun requires a separate install step that trips up CI environments and contributors.

Bun may still be used as a local development tool (it is fast), but the package must run correctly on Node.js without Bun present.

---

## 18. Migration from v3

### 18.1 Breaking Changes

| Area | v3 | v4 | Action Required |
|---|---|---|---|
| Terminology | "objective" | "epic" | Rename all state files, directories, and CLI invocations |
| CLI flag | `-o` / `--objective` | `-e` / `--epic` | Update scripts and aliases |
| Lane directories | arbitrary names | `0-backlog/`, `1-ready/`, etc. | Run migration script (see 18.3) |
| `state.json` shape | `{ name, step, status }` | `CoreState` (adds `type`, `lane`, `disposition`, `estimate`) | Migration script adds missing fields |
| Config schema | v3 settings.json | v4 settings.json | Manual review required; see 18.2 |
| Runtime | Bun required | Node.js required | Update CI and install docs |

### 18.2 Dead Config Keys (Removed in v4)

The following keys existed in v3 `settings.json` and are **silently ignored** in v4. They should be removed from project configs to avoid confusion:

| Key | Reason Removed |
|---|---|
| `pipeline.arch_review` | Dead, never invoked |
| `pipeline.code_review` | Dead, never invoked |
| `execution.group_parallel` | Superseded by pluggable step skills |
| `execution.discipline` | Superseded by pluggable step skills |
| `decompose.custom_scale` | Dead |
| `flow.pause_on_config_change` | Dead |
| `flow.pause_on_low_context` | Dead |
| `tools.last_scan` | Dead |
| `naming.*` | Dead |
| `context_skills` | Dead |
| `strings.commit_messages.*` | Replaced by `commit.message_format` |
| `strings.research_section` | Dead |
| `strings.status_line` | Dead |
| `templates.changelog_entry` | Duplicate of another key, dead |

Presets removed: `gstack`, `nimbalyst` (removed in v3, not reinstated in v4).

### 18.3 Migration Script

`tx migrate` (new command) performs the following steps:

1. Detects v3 `.twisted/` structure (no numeric-prefix lanes)
2. Prompts user to confirm
3. Renames lane directories to numeric-prefix names:
   - `todo/` → `0-backlog/`
   - `ready/` (if exists) → `1-ready/`
   - `scoped/` (if exists) → `2-scoped/`
   - `in-progress/` → `3-started/`
   - `done/` → `4-done/`
   - `archived/` (if exists) → `5-archived/`
4. Renames each `{objective}/` subdirectory to match (directories keep their names — only parent lane dir renames)
5. For each `state.json`:
   - Adds `type: "feature"` (default; user should review and correct)
   - Adds `lane: <inferred from directory>`
   - Preserves existing fields
   - Adds `metadata: {}`
6. Adds `"version": 4` to `settings.json`
7. Removes dead config keys from `settings.json`
8. Reports all changes made

The migration script is non-destructive: it creates a `.twisted-v3-backup/` tarball before making changes.

### 18.4 Coexistence

v3 and v4 cannot coexist in the same `.twisted/` directory. The migration is a one-way operation. If a project needs to run both versions (e.g., during a phased rollout), use separate branches.

---

## 19. Engine State Machine (XState)

### 19.1 Decision

The v4 engine will use **XState v5** (`xstate` package, Node.js only) as the state machine implementation. The pseudocode in §9 describes the algorithm; this section describes how that algorithm maps to XState concepts.

XState v5 is chosen over alternatives for three reasons:

1. **First-class persistence** — `actor.getPersistedSnapshot()` / `createActor(machine, { snapshot })` maps directly onto the `.twisted/{lane}/{epic}/state.json` pattern. State survives across CLI invocations with one JSON write/read.
2. **Typed statecharts** — the `setup()` API provides inference over context and events without `as any`. Guards, actions, and actors are declared once and referenced by name.
3. **Zero runtime dependencies, pure Node.js** — no DOM, no React, no bundler required. Works in Node.js 20+.

### 19.2 How the Engine Maps to XState

The v4 engine models two separate machines:

**Machine A: `epicMachine`** — per-epic lifecycle

```
states:
  evaluating    ← entry state on each `tx next` call
  running       ← a step's skill is executing
  blocked       ← at least one step has unmet requires
  advancingLane ← all steps done, entry checks pass, moving to next lane
  complete      ← terminal lane reached, no next lane
  archived      ← epic was explicitly archived
```

**Machine B: `stepMachine`** (invoked as a child actor from `epicMachine.running`)

Each step runs as an invoked Promise actor. The promise resolves when the skill completes and all `produces` artifacts exist on disk. It rejects if the skill exits non-zero or times out.

### 19.3 Context Shape

```typescript
import { setup, assign, fromPromise } from "xstate";

interface EpicContext {
  epicName: string;
  epicDir: string;
  epicType: string;
  lane: string;
  step: string | null;
  evaluations: StepEvaluation[];   // from §9.2
  blockedOn: ArtifactRef[];
  error: string | null;
}

type EpicEvent =
  | { type: "NEXT" }
  | { type: "STEP_DONE"; step: string }
  | { type: "STEP_FAILED"; error: string }
  | { type: "ARCHIVE"; reason: string };
```

### 19.4 Machine Definition Sketch

```typescript
const epicMachine = setup({
  types: {
    context: {} as EpicContext,
    events: {} as EpicEvent,
    input: {} as { epicName: string; epicDir: string; config: TwistedConfig },
  },
  guards: {
    hasRunnableStep: ({ context }) =>
      context.evaluations.some((e) => e.status === "runnable"),
    allStepsDone: ({ context }) =>
      context.evaluations.every((e) => e.status === "done" || e.status === "skipped"),
    canAdvanceLane: ({ context }) =>
      /* check entry_requires for next lane */ true,
  },
  actions: {
    evaluateSteps: assign(({ context }) => ({
      evaluations: computeEvaluations(context.epicDir, context.lane, config),
    })),
    setNextStep: assign(({ context }) => ({
      step: context.evaluations.find((e) => e.status === "runnable")?.step ?? null,
    })),
    advanceLane: assign(({ context }) => ({
      lane: getNextLane(context.lane, context.epicType, config),
      step: null,
    })),
    persistState: ({ context }) => {
      writeStateJson(context.epicDir, {
        lane: context.lane,
        step: context.step,
        updated: new Date().toISOString(),
      });
    },
    moveEpicDir: ({ context }) => {
      moveDir(
        path.join(".twisted", oldLane, context.epicName),
        path.join(".twisted", context.lane, context.epicName)
      );
    },
  },
  actors: {
    runStep: fromPromise(async ({ input }: { input: { step: string; epicDir: string } }) => {
      await invokeSkill(input.step, input.epicDir);
    }),
  },
}).createMachine({
  id: "epic",
  initial: "evaluating",
  context: ({ input }) => ({
    epicName: input.epicName,
    epicDir: input.epicDir,
    epicType: readStateJson(input.epicDir).type,
    lane: readStateJson(input.epicDir).lane,
    step: null,
    evaluations: [],
    blockedOn: [],
    error: null,
  }),
  states: {
    evaluating: {
      entry: ["evaluateSteps"],
      always: [
        { guard: "hasRunnableStep", target: "running", actions: ["setNextStep"] },
        { guard: "allStepsDone", target: "advancingLane" },
        { target: "blocked" },
      ],
    },
    running: {
      invoke: {
        src: "runStep",
        input: ({ context }) => ({ step: context.step!, epicDir: context.epicDir }),
        onDone: { target: "evaluating" },
        onError: { target: "failed", actions: assign({ error: ({ event }) => String(event.error) }) },
      },
    },
    advancingLane: {
      always: [
        { guard: "canAdvanceLane", target: "evaluating", actions: ["advanceLane", "moveEpicDir", "persistState"] },
        { target: "blocked" },
      ],
    },
    blocked: { type: "final" },
    complete: { type: "final" },
    failed: { type: "final" },
    archived: { type: "final" },
  },
});
```

### 19.5 CLI Integration Pattern

Each `tx next` invocation creates a fresh actor, rehydrates from `state.json`, runs until it reaches a final state or pauses, then persists before exit:

```typescript
async function txNext(epicName: string, config: TwistedConfig) {
  const epicDir = resolveEpicDir(epicName);
  const persisted = readPersistedState(epicDir); // may be undefined for new epics

  const actor = createActor(epicMachine, {
    input: { epicName, epicDir, config },
    snapshot: persisted ?? undefined,
  });

  // Collect output for --agent JSON mode
  let finalSnapshot: typeof actor.getSnapshot;

  actor.subscribe((snapshot) => {
    finalSnapshot = snapshot;
  });

  actor.start();

  // Wait for the machine to reach a final state
  await waitFor(actor, (s) => s.status === "done");

  // Persist
  const toSave = actor.getPersistedSnapshot();
  writePersistedState(epicDir, toSave);

  actor.stop();
  return finalSnapshot;
}
```

`waitFor` is imported from `xstate`: it returns a Promise that resolves when the predicate holds.

### 19.6 What XState Does NOT Own

XState owns the **step sequencing and lane transition logic only**. It does not own:

- File I/O (reads/writes to `.twisted/`) — that stays in `src/cli/fs.ts`
- Skill invocation — remains in `src/artifacts/` or equivalent
- Config resolution — remains in `src/config/`
- Output formatting — remains in the CLI layer

The machine is given `epicDir` and `config` as inputs. All side effects (file writes, directory moves) happen in named actions that are pure functions injected into the machine's `actions` map. This keeps the machine testable: substitute no-op actions in unit tests, real I/O in integration tests.

### 19.7 Dependency

Add to `package.json` dependencies:

```json
"xstate": "^5.20.0"
```

No other XState packages are needed. Framework adapters (`@xstate/react`, etc.) are not installed.

---

## 20. Deferred Work

The following items were explicitly discussed and deliberately excluded from v4 scope. They are recorded here so future contributors understand the reasoning and do not re-litigate them prematurely.

### 20.1 Deferred Features

| Feature | Reason Deferred |
|---|---|
| **Planning poker** | Novel feature with uncertain UX. Needs real usage to inform design. The `poker_session` field is reserved in the schema so the artifact path is stable when poker is added. |
| **Persona-based agent assignment** | Interesting but adds complexity before the core model is stable. Build after v4 ships. |
| **Cross-epic dependencies** | Requires a dependency graph model that is not trivially expressible in the flat filesystem structure. Defer until there is a concrete use case. |
| **Sprint containers** | Grouping epics into time-boxed sprints is a valid workflow but adds a layer above epics that v4 is not ready for. |
| **Velocity tracking** | Depends on story points and sprint containers both being stable. Defer until those ship. |
| **Generated human-readable .md views** | Nice-to-have for reading state without the CLI. Low priority; the CLI covers the need. |
| **Web UI** | Out of scope for a CLI tool. If a web UI is ever built, it should be a separate project that consumes the `.twisted/` filesystem as its data store. |
| **Multi-user / network server mode** | The daemon architecture supports one machine. Multi-user requires network-accessible state and authentication. Significant scope expansion — defer. |
| **VM isolates / sandboxing** | Running agent skills in isolated VMs would improve security. Complex to implement. Defer. |

### 20.2 Notes on Planning Poker

Planning poker was discussed at length and recognized as a genuinely novel contribution. The current schema reserves `poker_session` as a path to a session file. When planning poker is eventually implemented:

- The session file format will be defined then
- The `estimate` step skill will be extended to write a session file
- The engine requires no changes — `poker_session` is metadata only

### 20.3 Notes on Cross-Epic Dependencies

Cross-epic dependencies were discussed and deferred because they require:

1. A global dependency graph (not representable per-epic)
2. A scheduler that can block one epic on another's lane advancement
3. A way to express this in config without breaking the simple `types.lanes[]` model

None of these are unsolvable, but they represent a significant complexity jump. The single-epic model is the right foundation to ship first.

---

*End of specification.*
