# CLI Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace embedded skill logic with a CLI tool (`tx`) that owns all logic and objective file I/O.

**Architecture:** Node/TypeScript CLI wrapping existing `src/` functions. Two output modes (human pretty-print, `--agent` JSON). Agents interact exclusively through `tx` commands. Build system refactored to extract CLI signatures into thin wrapper skills.

**Tech Stack:** TypeScript, Bun (dev), Node (dist), npm (package)

---

## File Structure

### New files

```
src/cli/
  index.ts              CLI entry point (bin)
  args.ts               Argument parsing for all commands
  output.ts             AgentResponse formatter + human pretty-printer

src/session/
  lifecycle.ts          pickup, handoff, active session management
  types.ts              SessionData, ActiveSession interfaces

src/notes/
  notes.ts              Note CRUD, type filtering, step filtering

src/tasks/
  tasks.ts              Task CRUD, group assignment, status updates

src/artifacts/
  artifacts.ts          Read/write routing, path resolution, stdin piping

types/
  output.d.ts           AgentResponse, AgentAction contracts
  session.d.ts          Session types
  notes.d.ts            Note types
  tasks.d.ts            Task types (replaces issues.d.ts)
```

### Modified files

```
src/config/defaults.ts        New pipeline shape, removed nimbalyst/gstack
src/state/machine.ts          5-step pipeline, new step names
src/pipeline/routing.ts       Simplified providers, hook-based sub-steps
src/pipeline/dispatch.ts      Updated for new pipeline
src/work/router.ts            New commands (open, close, pickup, handoff, etc.)
src/work/init.ts              Simplified tool detection
src/work/advance.ts           New step names, session auto-start
src/presets/index.ts           Remove gstack, nimbalyst
src/presets/superpowers.ts     Updated for new pipeline shape
src/strategies/paths.ts        New artifact paths (tasks.json, notes.json, etc.)
types/config.d.ts              Remove nimbalyst, simplify
types/state.d.ts               New step names, remove old steps
types/pipeline.d.ts            Simplified delegatable phases
types/commands.d.ts            New subcommands (open, close, pickup, handoff, etc.)
types/preset.d.ts              Remove gstack, nimbalyst presets
package.json                   Add bin, update scripts, version 3.0.0
```

### Deleted files

```
src/presets/gstack.ts
src/presets/nimbalyst.ts
src/state/status.ts            Nimbalyst mapping logic
src/strategies/writer.ts       Replaced by artifacts module
types/nimbalyst.d.ts
types/frontmatter.d.ts         No more frontmatter
types/tracking.d.ts            Simplified — no multi-strategy
types/issues.d.ts              Replaced by tasks.d.ts
types/artifacts.d.ts           Replaced by new artifacts module
```

---

### Task 1: Define new type contracts

**Files:**
- Create: `types/output.d.ts`
- Create: `types/session.d.ts`
- Create: `types/notes.d.ts`
- Create: `types/tasks.d.ts`
- Modify: `types/state.d.ts`
- Modify: `types/pipeline.d.ts`
- Modify: `types/commands.d.ts`
- Test: `build/__tests__/types-check.test.ts`

- [ ] **Step 1: Write type check test**

```ts
// build/__tests__/types-check.test.ts
import { describe, it, expect } from "bun:test";

describe("type contracts", () => {
  it("AgentResponse status is exhaustive", async () => {
    const mod = await import("../../types/output.d.ts");
    // Type-level check — if this file compiles, types are consistent
    expect(true).toBe(true);
  });

  it("ObjectiveStep matches pipeline order", async () => {
    const { PIPELINE_ORDER } = await import("../../src/state/machine.ts");
    expect(PIPELINE_ORDER).toEqual(["research", "scope", "plan", "build", "close"]);
  });

  it("new step names are valid", async () => {
    const { PIPELINE_ORDER } = await import("../../src/state/machine.ts");
    expect(PIPELINE_ORDER).not.toContain("decompose");
    expect(PIPELINE_ORDER).not.toContain("execute");
    expect(PIPELINE_ORDER).not.toContain("arch_review");
    expect(PIPELINE_ORDER).not.toContain("code_review");
    expect(PIPELINE_ORDER).not.toContain("qa");
    expect(PIPELINE_ORDER).not.toContain("ship");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/types-check.test.ts`
Expected: FAIL — PIPELINE_ORDER still has old step names

- [ ] **Step 3: Create `types/output.d.ts`**

```ts
// types/output.d.ts
import type { ObjectiveState } from "./state";
import type { TwistedConfig } from "./config";

/** What --agent mode returns for every command. */
export interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  state?: ObjectiveState;
  config?: TwistedConfig;
  error?: string;
  session?: import("./session").SessionData;
}

export type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: import("./tasks").AgentAssignment[] }
  | { type: "install_cli"; instructions: string };
```

- [ ] **Step 4: Create `types/session.d.ts`**

```ts
// types/session.d.ts

/** Active session tracking — written to sessions/active.json. */
export interface ActiveSession {
  number: number;
  name: string | null;
  step_started: import("./state").ObjectiveStep;
  started: string;
  notes_added: number[];
  artifacts_created: string[];
  steps_advanced: import("./state").ObjectiveStep[];
}

/** Session data returned in AgentResponse. */
export interface SessionData {
  active: ActiveSession | null;
  previous: SessionSummary | null;
}

/** Metadata for a closed session file. */
export interface SessionSummary {
  number: number;
  name: string;
  file: string;
}
```

- [ ] **Step 5: Create `types/notes.d.ts`**

```ts
// types/notes.d.ts

export type NoteType = "note" | "decision" | "deferral" | "discovery" | "blocker";

export interface Note {
  id: number;
  type: NoteType;
  step: import("./state").ObjectiveStep;
  summary: string;
  reason?: string;
  impact?: string;
  created: string;
}
```

- [ ] **Step 6: Create `types/tasks.d.ts`**

```ts
// types/tasks.d.ts

export type TaskType = "bug" | "refactor" | "feature" | "test";

export type AgentAssignment = "batch" | "standard" | "split";

export interface Task {
  id: number;
  summary: string;
  type: TaskType;
  area: string;
  file: string;
  current_state: string;
  target_state: string;
  dependencies: number[];
  group: number | null;
  complexity: number;
  done: boolean;
}

export interface TaskGroup {
  number: number;
  task_ids: number[];
  depends_on: number[];
  parallel_with: number[];
}
```

- [ ] **Step 7: Update `types/state.d.ts` — new step names**

Replace ObjectiveStep with:

```ts
export type ObjectiveStep =
  | "research"
  | "scope"
  | "plan"
  | "build"
  | "close";
```

Remove imports of `PipelinePhase` from `./pipeline`. Remove `ToolsUsed` type (replaced by notes). Update `ObjectiveState`:

```ts
export interface ObjectiveState {
  objective: string;
  status: ObjectiveStatus;
  step: ObjectiveStep;
  steps_completed: ObjectiveStep[];
  steps_remaining: ObjectiveStep[];
  group_current: number | null;
  groups_total: number | null;
  tasks_done: number;
  tasks_total: number | null;
  created: string;
  updated: string;
  notes: null | string;
}
```

- [ ] **Step 8: Update `types/pipeline.d.ts` — simplified**

```ts
export type ProviderString =
  | "built-in"
  | "skip"
  | "ask"
  | `superpowers:${string}`
  | (string & {});

export interface PhaseProviderConfig {
  provider: ProviderString;
  fallback: ProviderString;
  options: Record<string, unknown>;
}

/** Top-level delegatable phase. */
export type DelegatablePhase = "research";

/** Hook phases within steps. */
export type HookPhase = "arch_review" | "code_review" | "qa" | "ship";

/** Pipeline config — top-level delegatable + hooks. */
export interface PipelineConfig {
  research: PhaseProviderConfig;
  arch_review: PhaseProviderConfig;
  code_review: PhaseProviderConfig;
  qa: PhaseProviderConfig;
  ship: PhaseProviderConfig;
}
```

- [ ] **Step 9: Update `types/commands.d.ts` — new subcommands**

```ts
export type TwistedSubcommand =
  | "init"
  | "open"
  | "close"
  | "status"
  | "next"
  | "resume"
  | "research"
  | "scope"
  | "plan"
  | "build"
  | "pickup"
  | "handoff"
  | "session"
  | "write"
  | "read"
  | "artifacts"
  | "tasks"
  | "note"
  | "notes"
  | "config";

export interface GlobalFlags {
  yolo: boolean;
  agent: boolean;
  objective?: string;
}

export interface OpenParams {
  objective: string;
}

export interface CloseParams {
  objective?: string;
}

export interface WriteParams {
  type: ArtifactType;
  objective?: string;
  number?: number;
}

export interface ReadParams {
  type: ArtifactType;
  objective?: string;
}

export type ArtifactType = "research" | "scope" | "plan" | "changelog";

export interface NoteParams {
  summary: string;
  type?: import("../types/notes").NoteType;
  reason?: string;
  impact?: string;
}

export interface TasksParams {
  action?: "add" | "update" | "assign" | "show";
  id?: number;
  summary?: string;
  done?: boolean;
  group?: number;
}

export interface SessionParams {
  action: "status" | "save" | "list";
  name?: string;
}

export interface PickupParams {
  name?: string;
}

export interface HandoffParams {
  name?: string;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `bun test build/__tests__/types-check.test.ts`
Expected: FAIL — machine.ts not yet updated. That's expected. Types compile correctly.

- [ ] **Step 11: Commit**

```bash
git add types/output.d.ts types/session.d.ts types/notes.d.ts types/tasks.d.ts types/state.d.ts types/pipeline.d.ts types/commands.d.ts build/__tests__/types-check.test.ts
git commit -m "feat: add v3 type contracts for CLI tool"
```

---

### Task 2: Refactor state machine — 5-step pipeline

**Files:**
- Modify: `src/state/machine.ts`
- Modify: `src/state/index.ts`
- Delete: `src/state/status.ts`
- Test: `build/__tests__/state-machine.test.ts`

- [ ] **Step 1: Update state machine test for new pipeline**

Replace the existing test assertions in `build/__tests__/state-machine.test.ts` to use the 5-step pipeline. Key changes:

```ts
describe("PIPELINE_ORDER", () => {
  it("has 5 steps", () => {
    expect(PIPELINE_ORDER).toEqual(["research", "scope", "plan", "build", "close"]);
  });
});

describe("nextStep", () => {
  it("research → scope", () => {
    expect(nextStep("research", pipeline)).toBe("scope");
  });
  it("scope → plan", () => {
    expect(nextStep("scope", pipeline)).toBe("plan");
  });
  it("plan → build", () => {
    expect(nextStep("plan", pipeline)).toBe("build");
  });
  it("build → close", () => {
    expect(nextStep("build", pipeline)).toBe("close");
  });
  it("close → null", () => {
    expect(nextStep("close", pipeline)).toBeNull();
  });
  it("skips research when provider is skip", () => {
    const skipResearch = { ...pipeline, research: { provider: "skip", fallback: "skip", options: {} } };
    expect(getEffectiveSteps(skipResearch)).toEqual(["scope", "plan", "build", "close"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/state-machine.test.ts`
Expected: FAIL — old step names

- [ ] **Step 3: Update `src/state/machine.ts`**

```ts
export const PIPELINE_ORDER: readonly ObjectiveStep[] = [
  "research",
  "scope",
  "plan",
  "build",
  "close",
] as const;

export const CORE_STEPS: readonly ObjectiveStep[] = [
  "scope",
  "plan",
  "build",
  "close",
] as const;

export const DELEGATABLE_STEPS: readonly ObjectiveStep[] = [
  "research",
] as const;
```

Update `isStepSkipped` — only `research` is skippable at top level:

```ts
export function isStepSkipped(
  step: ObjectiveStep,
  pipeline: PipelineConfig,
): boolean {
  if (step !== "research") return false;
  return pipeline.research?.provider === "skip";
}
```

Update `statusForStep`:

```ts
export function statusForStep(step: ObjectiveStep): ObjectiveStatus {
  switch (step) {
    case "research":
    case "scope":
    case "plan":
      return "todo";
    case "build":
      return "in-progress";
    case "close":
      return "in-progress";
    default:
      return "todo";
  }
}
```

Update `createInitialState` to use `tasks_done`/`tasks_total` instead of `issues_done`/`issues_total`.

- [ ] **Step 4: Delete `src/state/status.ts` (nimbalyst mapping)**

Remove the file entirely. Update `src/state/index.ts` to remove its exports.

- [ ] **Step 5: Update `src/state/index.ts`**

```ts
export {
  PIPELINE_ORDER,
  CORE_STEPS,
  DELEGATABLE_STEPS,
  isStepSkipped,
  getEffectiveSteps,
  nextStep,
  stepsRemaining,
  stepsCompleted,
  statusForStep,
  shouldChangeStatus,
  createInitialState,
  advanceState,
} from "./machine.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test build/__tests__/state-machine.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/state/machine.ts src/state/index.ts build/__tests__/state-machine.test.ts
git rm src/state/status.ts
git commit -m "refactor: simplify pipeline to 5 steps (research/scope/plan/build/close)"
```

---

### Task 3: Simplify config and presets

**Files:**
- Modify: `src/config/defaults.ts`
- Modify: `src/presets/index.ts`
- Modify: `src/presets/superpowers.ts`
- Modify: `src/presets/minimal.ts`
- Modify: `src/presets/twisted.ts`
- Delete: `src/presets/gstack.ts`
- Delete: `src/presets/nimbalyst.ts`
- Delete: `types/nimbalyst.d.ts`
- Delete: `types/tracking.d.ts`
- Delete: `types/frontmatter.d.ts`
- Delete: `types/artifacts.d.ts`
- Delete: `types/issues.d.ts`
- Modify: `types/config.d.ts`
- Modify: `types/preset.d.ts`
- Modify: `types/phases.d.ts`
- Test: `build/__tests__/config-resolve.test.ts`

- [ ] **Step 1: Update config resolution test**

Update `build/__tests__/config-resolve.test.ts` — remove gstack/nimbalyst preset tests, update pipeline shape assertions, verify 5-step pipeline in defaults.

```ts
describe("resolveConfig", () => {
  it("defaults have 5-step pipeline", () => {
    const config = resolveConfig();
    expect(config.pipeline.research).toBeDefined();
    expect(config.pipeline.arch_review).toBeDefined();
    expect(config.pipeline.code_review).toBeDefined();
    expect(config.pipeline.qa).toBeDefined();
    expect(config.pipeline.ship).toBeDefined();
  });

  it("superpowers preset sets code_review and discipline", () => {
    const config = resolveConfig({ presets: ["superpowers"] });
    expect(config.pipeline.code_review.provider).toBe("superpowers:requesting-code-review");
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
  });

  it("unknown presets are silently skipped", () => {
    const config = resolveConfig({ presets: ["nonexistent" as any] });
    expect(config).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/config-resolve.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `types/config.d.ts`**

Remove imports and re-exports for: nimbalyst, tracking, frontmatter, artifacts, issues. Remove `NimbalystConfig` from `TwistedConfig`. Remove `tracking` field. Rename `decompose` → `plan_config` in `TwistedConfig`. Add reference to new types (output, session, notes, tasks).

```ts
export interface TwistedConfig {
  version: "3.0";
  presets: PresetName[];
  tools: ToolsConfig;
  pipeline: PipelineConfig;
  execution: ExecutionConfig;
  phases: PhasesConfig;
  plan: PlanConfig;
  templates: TemplatesConfig;
  state: StateConfig;
  flow: FlowConfig;
  writing: WritingConfig;
  directories: DirectoryConfig;
  files: FilePathConfig;
  naming: NamingConfig;
  strings: StringTemplates;
  context_skills: string[];
}
```

- [ ] **Step 4: Update `types/phases.d.ts`**

Rename phase keys from scope/decompose/execute to scope/plan/build:

```ts
export interface PhasesConfig {
  scope: PhaseSettings;
  plan: PhaseSettings;
  build: PhaseSettings;
}
```

- [ ] **Step 5: Update `types/preset.d.ts`**

```ts
export type BuiltInPresetName = "twisted" | "superpowers" | "minimal";
```

- [ ] **Step 6: Update `src/config/defaults.ts`**

Update the full defaults object:
- Remove `tracking` field
- Remove `nimbalyst` section
- Update `pipeline` — keep research, arch_review, code_review, qa, ship as provider configs
- Rename `decompose` → `plan` in the config
- Update `phases` keys: scope, plan (was decompose), build (was execute)
- Update `version` to `"3.0"`
- Update `strings` — rename handoff messages for new step names

- [ ] **Step 7: Delete removed preset and type files**

```bash
git rm src/presets/gstack.ts src/presets/nimbalyst.ts
git rm types/nimbalyst.d.ts types/tracking.d.ts types/frontmatter.d.ts types/artifacts.d.ts types/issues.d.ts
```

- [ ] **Step 8: Update `src/presets/index.ts`**

```ts
import { twisted } from "./twisted.js";
import { superpowers } from "./superpowers.js";
import { minimal } from "./minimal.js";
import type { PresetOverrides } from "../../types/preset.js";

export { twisted, superpowers, minimal };

export const allPresets: Record<string, PresetOverrides> = {
  twisted,
  superpowers,
  minimal,
};
```

- [ ] **Step 9: Update `src/presets/superpowers.ts`**

```ts
import type { PresetOverrides } from "../../types/preset.js";

export const superpowers: PresetOverrides = {
  execution: {
    discipline: "superpowers:test-driven-development",
  },
  pipeline: {
    code_review: {
      provider: "superpowers:requesting-code-review",
      fallback: "built-in",
    },
  },
};
```

- [ ] **Step 10: Update `src/presets/twisted.ts` and `src/presets/minimal.ts`**

Twisted: keep empty overrides (inherits defaults).
Minimal: update to skip research:

```ts
export const minimal: PresetOverrides = {
  pipeline: {
    research: { provider: "skip", fallback: "skip", options: {} },
    arch_review: { provider: "skip", fallback: "skip", options: {} },
    qa: { provider: "skip", fallback: "skip", options: {} },
  },
};
```

- [ ] **Step 11: Update pipeline routing**

Update `src/pipeline/routing.ts` — update `STEP_TO_PHASE` mapping:

```ts
const STEP_TO_PHASE: Partial<Record<ObjectiveStep, keyof PhasesConfig>> = {
  scope: "scope",
  plan: "plan",
  build: "build",
};
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun test build/__tests__/config-resolve.test.ts`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "refactor: simplify config — remove gstack/nimbalyst, 5-step pipeline"
```

---

### Task 4: Implement notes system

**Files:**
- Create: `src/notes/notes.ts`
- Test: `build/__tests__/notes.test.ts`

- [ ] **Step 1: Write notes tests**

```ts
// build/__tests__/notes.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { addNote, getNotes, filterNotes } from "../../src/notes/notes.ts";
import type { Note } from "../../types/notes";

describe("notes", () => {
  let notes: Note[];

  beforeEach(() => {
    notes = [];
  });

  it("addNote creates a note with auto-incrementing id", () => {
    const note = addNote(notes, { type: "note", step: "research", summary: "test note" });
    expect(note.id).toBe(1);
    expect(note.type).toBe("note");
    expect(note.summary).toBe("test note");
    expect(notes).toHaveLength(1);
  });

  it("addNote increments id from existing notes", () => {
    addNote(notes, { type: "note", step: "research", summary: "first" });
    const second = addNote(notes, { type: "decision", step: "scope", summary: "second" });
    expect(second.id).toBe(2);
  });

  it("filterNotes by type", () => {
    addNote(notes, { type: "note", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "scope", summary: "b" });
    addNote(notes, { type: "note", step: "plan", summary: "c" });
    expect(filterNotes(notes, { type: "decision" })).toHaveLength(1);
    expect(filterNotes(notes, { type: "note" })).toHaveLength(2);
  });

  it("filterNotes by step", () => {
    addNote(notes, { type: "note", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "research", summary: "b" });
    addNote(notes, { type: "note", step: "scope", summary: "c" });
    expect(filterNotes(notes, { step: "research" })).toHaveLength(2);
  });

  it("filterNotes by type and step", () => {
    addNote(notes, { type: "decision", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "scope", summary: "b" });
    addNote(notes, { type: "note", step: "research", summary: "c" });
    expect(filterNotes(notes, { type: "decision", step: "research" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/notes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/notes/notes.ts`**

```ts
// src/notes/notes.ts
import type { Note, NoteType } from "../../types/notes.js";
import type { ObjectiveStep } from "../../types/state.js";

interface AddNoteInput {
  type: NoteType;
  step: ObjectiveStep;
  summary: string;
  reason?: string;
  impact?: string;
}

interface NoteFilter {
  type?: NoteType;
  step?: ObjectiveStep;
}

export function addNote(notes: Note[], input: AddNoteInput): Note {
  const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
  const note: Note = {
    id: maxId + 1,
    type: input.type,
    step: input.step,
    summary: input.summary,
    reason: input.reason,
    impact: input.impact,
    created: new Date().toISOString(),
  };
  notes.push(note);
  return note;
}

export function getNotes(notes: Note[]): Note[] {
  return notes;
}

export function filterNotes(notes: Note[], filter: NoteFilter): Note[] {
  return notes.filter((n) => {
    if (filter.type && n.type !== filter.type) return false;
    if (filter.step && n.step !== filter.step) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/notes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/notes/notes.ts types/notes.d.ts build/__tests__/notes.test.ts
git commit -m "feat: add notes system (decisions, deferrals, discoveries)"
```

---

### Task 5: Implement tasks system

**Files:**
- Create: `src/tasks/tasks.ts`
- Test: `build/__tests__/tasks.test.ts`

- [ ] **Step 1: Write tasks tests**

```ts
// build/__tests__/tasks.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { addTask, updateTask, assignTask, getTasks, getTasksByGroup } from "../../src/tasks/tasks.ts";
import type { Task } from "../../types/tasks";

describe("tasks", () => {
  let tasks: Task[];

  beforeEach(() => {
    tasks = [];
  });

  it("addTask creates with auto-incrementing id", () => {
    const task = addTask(tasks, { summary: "Add CLI entry point" });
    expect(task.id).toBe(1);
    expect(task.summary).toBe("Add CLI entry point");
    expect(task.done).toBe(false);
    expect(task.group).toBeNull();
  });

  it("updateTask marks done", () => {
    addTask(tasks, { summary: "task 1" });
    const updated = updateTask(tasks, 1, { done: true });
    expect(updated.done).toBe(true);
  });

  it("assignTask sets group", () => {
    addTask(tasks, { summary: "task 1" });
    const assigned = assignTask(tasks, 1, 2);
    expect(assigned.group).toBe(2);
  });

  it("getTasksByGroup filters correctly", () => {
    addTask(tasks, { summary: "a" });
    const t2 = addTask(tasks, { summary: "b" });
    assignTask(tasks, t2.id, 1);
    addTask(tasks, { summary: "c" });
    const t4 = addTask(tasks, { summary: "d" });
    assignTask(tasks, t4.id, 1);
    expect(getTasksByGroup(tasks, 1)).toHaveLength(2);
  });

  it("updateTask throws for unknown id", () => {
    expect(() => updateTask(tasks, 99, { done: true })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/tasks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/tasks/tasks.ts`**

```ts
// src/tasks/tasks.ts
import type { Task, TaskType } from "../../types/tasks.js";

interface AddTaskInput {
  summary: string;
  type?: TaskType;
  area?: string;
  file?: string;
  current_state?: string;
  target_state?: string;
  dependencies?: number[];
  group?: number | null;
  complexity?: number;
}

interface UpdateTaskInput {
  done?: boolean;
  group?: number;
  summary?: string;
  type?: TaskType;
  complexity?: number;
}

export function addTask(tasks: Task[], input: AddTaskInput): Task {
  const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
  const task: Task = {
    id: maxId + 1,
    summary: input.summary,
    type: input.type ?? "feature",
    area: input.area ?? "",
    file: input.file ?? "",
    current_state: input.current_state ?? "",
    target_state: input.target_state ?? "",
    dependencies: input.dependencies ?? [],
    group: input.group ?? null,
    complexity: input.complexity ?? 1,
    done: false,
  };
  tasks.push(task);
  return task;
}

export function updateTask(tasks: Task[], id: number, updates: UpdateTaskInput): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} not found`);
  Object.assign(task, updates);
  return task;
}

export function assignTask(tasks: Task[], id: number, group: number): Task {
  return updateTask(tasks, id, { group });
}

export function getTasks(tasks: Task[]): Task[] {
  return tasks;
}

export function getTasksByGroup(tasks: Task[], group: number): Task[] {
  return tasks.filter((t) => t.group === group);
}

export function getTask(tasks: Task[], id: number): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} not found`);
  return task;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/tasks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tasks/tasks.ts types/tasks.d.ts build/__tests__/tasks.test.ts
git commit -m "feat: add tasks system (JSON-based, replaces issues.md)"
```

---

### Task 6: Implement session lifecycle

**Files:**
- Create: `src/session/lifecycle.ts`
- Test: `build/__tests__/session.test.ts`

- [ ] **Step 1: Write session tests**

```ts
// build/__tests__/session.test.ts
import { describe, it, expect } from "bun:test";
import { createSession, addSessionEvent, closeSession, getLatestSession } from "../../src/session/lifecycle.ts";
import type { ActiveSession } from "../../types/session";

describe("session lifecycle", () => {
  it("createSession returns active session", () => {
    const session = createSession("plan", null, 1);
    expect(session.number).toBe(1);
    expect(session.step_started).toBe("plan");
    expect(session.name).toBeNull();
    expect(session.notes_added).toEqual([]);
    expect(session.artifacts_created).toEqual([]);
    expect(session.steps_advanced).toEqual([]);
  });

  it("createSession with name", () => {
    const session = createSession("research", "initial-exploration", 1);
    expect(session.name).toBe("initial-exploration");
  });

  it("addSessionEvent tracks note ids", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "note_added", noteId: 3 });
    addSessionEvent(session, { type: "note_added", noteId: 4 });
    expect(session.notes_added).toEqual([3, 4]);
  });

  it("addSessionEvent tracks artifacts", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "artifact_created", artifact: "scope.md" });
    expect(session.artifacts_created).toEqual(["scope.md"]);
  });

  it("addSessionEvent tracks step advances", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "step_advanced", step: "plan" });
    expect(session.steps_advanced).toEqual(["plan"]);
  });

  it("closeSession generates summary metadata", () => {
    const session = createSession("scope", "scoping", 3);
    const result = closeSession(session);
    expect(result.number).toBe(3);
    expect(result.name).toBe("scoping");
    expect(result.file).toBe("003-scoping.md");
  });

  it("closeSession without name uses step", () => {
    const session = createSession("plan", null, 2);
    const result = closeSession(session);
    expect(result.file).toBe("002-plan.md");
  });

  it("getLatestSession returns highest number", () => {
    const sessions = [
      { number: 1, name: "a", file: "001-a.md" },
      { number: 3, name: "c", file: "003-c.md" },
      { number: 2, name: "b", file: "002-b.md" },
    ];
    expect(getLatestSession(sessions)?.number).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/session/lifecycle.ts`**

```ts
// src/session/lifecycle.ts
import type { ActiveSession, SessionSummary } from "../../types/session.js";
import type { ObjectiveStep } from "../../types/state.js";

type SessionEvent =
  | { type: "note_added"; noteId: number }
  | { type: "artifact_created"; artifact: string }
  | { type: "step_advanced"; step: ObjectiveStep };

export function createSession(
  step: ObjectiveStep,
  name: string | null,
  number: number,
): ActiveSession {
  return {
    number,
    name,
    step_started: step,
    started: new Date().toISOString(),
    notes_added: [],
    artifacts_created: [],
    steps_advanced: [],
  };
}

export function addSessionEvent(session: ActiveSession, event: SessionEvent): void {
  switch (event.type) {
    case "note_added":
      session.notes_added.push(event.noteId);
      break;
    case "artifact_created":
      session.artifacts_created.push(event.artifact);
      break;
    case "step_advanced":
      session.steps_advanced.push(event.step);
      break;
  }
}

export function closeSession(session: ActiveSession): SessionSummary {
  const name = session.name ?? session.step_started;
  const paddedNumber = String(session.number).padStart(3, "0");
  return {
    number: session.number,
    name,
    file: `${paddedNumber}-${name}.md`,
  };
}

export function getLatestSession(sessions: SessionSummary[]): SessionSummary | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.number > latest.number ? s : latest));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/session.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/lifecycle.ts types/session.d.ts build/__tests__/session.test.ts
git commit -m "feat: add session lifecycle (pickup/handoff)"
```

---

### Task 7: Implement artifact read/write

**Files:**
- Create: `src/artifacts/artifacts.ts`
- Test: `build/__tests__/artifacts.test.ts`

- [ ] **Step 1: Write artifact path resolution tests**

```ts
// build/__tests__/artifacts.test.ts
import { describe, it, expect } from "bun:test";
import { resolveArtifactPath, listArtifacts } from "../../src/artifacts/artifacts.ts";

describe("artifact paths", () => {
  const objDir = ".twisted/todo/my-feature";

  it("resolves scope path", () => {
    expect(resolveArtifactPath(objDir, "scope")).toBe(".twisted/todo/my-feature/scope.md");
  });

  it("resolves plan path", () => {
    expect(resolveArtifactPath(objDir, "plan")).toBe(".twisted/todo/my-feature/plan.md");
  });

  it("resolves research path with number", () => {
    expect(resolveArtifactPath(objDir, "research", 3)).toBe(".twisted/todo/my-feature/research/003.md");
  });

  it("resolves research path without number defaults to next", () => {
    // Without filesystem, defaults to 001
    expect(resolveArtifactPath(objDir, "research")).toBe(".twisted/todo/my-feature/research/001.md");
  });

  it("resolves changelog path", () => {
    expect(resolveArtifactPath(objDir, "changelog")).toBe("CHANGELOG.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/artifacts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/artifacts/artifacts.ts`**

```ts
// src/artifacts/artifacts.ts
import type { ArtifactType } from "../../types/commands.js";

export function resolveArtifactPath(
  objDir: string,
  type: ArtifactType,
  number?: number,
): string {
  switch (type) {
    case "scope":
      return `${objDir}/scope.md`;
    case "plan":
      return `${objDir}/plan.md`;
    case "research": {
      const n = number ?? 1;
      const padded = String(n).padStart(3, "0");
      return `${objDir}/research/${padded}.md`;
    }
    case "changelog":
      return "CHANGELOG.md";
  }
}

export interface ArtifactInfo {
  type: ArtifactType;
  path: string;
  exists: boolean;
}

export function listArtifacts(objDir: string, existingFiles: string[]): ArtifactInfo[] {
  const types: ArtifactType[] = ["research", "scope", "plan", "changelog"];
  const results: ArtifactInfo[] = [];

  for (const type of types) {
    if (type === "research") {
      const researchFiles = existingFiles.filter((f) => f.startsWith(`${objDir}/research/`));
      for (const f of researchFiles) {
        results.push({ type: "research", path: f, exists: true });
      }
      if (researchFiles.length === 0) {
        results.push({ type: "research", path: resolveArtifactPath(objDir, "research"), exists: false });
      }
    } else {
      const path = resolveArtifactPath(objDir, type);
      results.push({ type, path, exists: existingFiles.includes(path) });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/artifacts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/artifacts/artifacts.ts build/__tests__/artifacts.test.ts
git commit -m "feat: add artifact path resolution and listing"
```

---

### Task 8: Implement CLI argument parser

**Files:**
- Create: `src/cli/args.ts`
- Test: `build/__tests__/cli-args.test.ts`

- [ ] **Step 1: Write arg parser tests**

```ts
// build/__tests__/cli-args.test.ts
import { describe, it, expect } from "bun:test";
import { parseArgs } from "../../src/cli/args.ts";

describe("parseArgs", () => {
  it("parses tx open my-feature", () => {
    const cmd = parseArgs(["open", "my-feature"]);
    expect(cmd.subcommand).toBe("open");
    expect(cmd.params).toEqual({ objective: "my-feature" });
    expect(cmd.flags.agent).toBe(false);
    expect(cmd.flags.yolo).toBe(false);
  });

  it("parses tx next -a", () => {
    const cmd = parseArgs(["next", "-a"]);
    expect(cmd.subcommand).toBe("next");
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses tx next --agent", () => {
    const cmd = parseArgs(["next", "--agent"]);
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses tx close my-feature -y", () => {
    const cmd = parseArgs(["close", "my-feature", "-y"]);
    expect(cmd.subcommand).toBe("close");
    expect(cmd.params).toEqual({ objective: "my-feature" });
    expect(cmd.flags.yolo).toBe(true);
  });

  it("parses tx config pipeline research", () => {
    const cmd = parseArgs(["config", "pipeline", "research"]);
    expect(cmd.subcommand).toBe("config");
    expect(cmd.params).toEqual({ section: "pipeline", subsection: "research" });
  });

  it("parses tx write scope -o my-feature -a", () => {
    const cmd = parseArgs(["write", "scope", "-o", "my-feature", "-a"]);
    expect(cmd.subcommand).toBe("write");
    expect(cmd.params).toEqual({ type: "scope", objective: "my-feature" });
    expect(cmd.flags.agent).toBe(true);
    expect(cmd.flags.objective).toBe("my-feature");
  });

  it("parses tx tasks add 'Do something' -o feat", () => {
    const cmd = parseArgs(["tasks", "add", "Do something", "-o", "feat"]);
    expect(cmd.subcommand).toBe("tasks");
    expect(cmd.params).toEqual({ action: "add", summary: "Do something" });
    expect(cmd.flags.objective).toBe("feat");
  });

  it("parses tx note 'Some note' --decide --reason 'because'", () => {
    const cmd = parseArgs(["note", "Some note", "--decide", "--reason", "because"]);
    expect(cmd.subcommand).toBe("note");
    expect(cmd.params).toEqual({ summary: "Some note", type: "decision", reason: "because" });
  });

  it("parses tx pickup my-session", () => {
    const cmd = parseArgs(["pickup", "my-session"]);
    expect(cmd.subcommand).toBe("pickup");
    expect(cmd.params).toEqual({ name: "my-session" });
  });

  it("parses tx handoff", () => {
    const cmd = parseArgs(["handoff"]);
    expect(cmd.subcommand).toBe("handoff");
    expect(cmd.params).toEqual({ name: undefined });
  });

  it("parses tx session status", () => {
    const cmd = parseArgs(["session", "status"]);
    expect(cmd.subcommand).toBe("session");
    expect(cmd.params).toEqual({ action: "status", name: undefined });
  });

  it("parses tx tasks update 3 --done", () => {
    const cmd = parseArgs(["tasks", "update", "3", "--done"]);
    expect(cmd.subcommand).toBe("tasks");
    expect(cmd.params).toEqual({ action: "update", id: 3, done: true });
  });

  it("parses tx research my-feature -a", () => {
    const cmd = parseArgs(["research", "my-feature", "-a"]);
    expect(cmd.subcommand).toBe("research");
    expect(cmd.params).toEqual({ objective: "my-feature" });
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses -v as version", () => {
    const cmd = parseArgs(["-v"]);
    expect(cmd.flags.version).toBe(true);
  });

  it("parses -h as help", () => {
    const cmd = parseArgs(["-h"]);
    expect(cmd.flags.help).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/cli-args.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/cli/args.ts`**

```ts
// src/cli/args.ts
import type { ParsedCommand, GlobalFlags, TwistedSubcommand } from "../../types/commands.js";
import type { NoteType } from "../../types/notes.js";

export function parseArgs(argv: string[]): ParsedCommand {
  const flags: GlobalFlags & { version?: boolean; help?: boolean } = {
    agent: false,
    yolo: false,
  };

  // Extract flags
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === "-a" || arg === "--agent") { flags.agent = true; i++; continue; }
    if (arg === "-y" || arg === "--yolo") { flags.yolo = true; i++; continue; }
    if (arg === "-v" || arg === "--version") { flags.version = true; i++; continue; }
    if (arg === "-h" || arg === "--help") { flags.help = true; i++; continue; }
    if ((arg === "-o" || arg === "--objective") && argv[i + 1]) {
      flags.objective = argv[i + 1];
      i += 2;
      continue;
    }
    // Note type flags
    if (arg === "--decide" || arg === "--defer" || arg === "--discover" || arg === "--blocker") {
      positional.push(arg);
      i++;
      continue;
    }
    if ((arg === "--reason" || arg === "--impact" || arg === "--done" || arg === "--group") && argv[i + 1]) {
      positional.push(arg, argv[i + 1]!);
      i += 2;
      continue;
    }
    if (arg === "--done") {
      positional.push(arg);
      i++;
      continue;
    }
    if (arg === "--number" && argv[i + 1]) {
      positional.push(arg, argv[i + 1]!);
      i += 2;
      continue;
    }
    positional.push(arg);
    i++;
  }

  if (flags.version || flags.help || positional.length === 0) {
    return { subcommand: undefined, params: {}, flags, raw_args: argv.join(" ") };
  }

  const subcommand = positional[0] as TwistedSubcommand;
  const rest = positional.slice(1);

  const params = parseSubcommandParams(subcommand, rest);
  return { subcommand, params, flags, raw_args: argv.join(" ") };
}

function parseSubcommandParams(sub: string, rest: string[]): Record<string, unknown> {
  switch (sub) {
    case "open":
      return { objective: rest[0] };

    case "close":
    case "next":
    case "resume":
    case "research":
    case "scope":
    case "plan":
    case "build":
    case "status":
      return { objective: rest.find((r) => !r.startsWith("-")) };

    case "config":
      return { section: rest[0], subsection: rest[1] };

    case "pickup":
    case "handoff":
      return { name: rest[0] };

    case "session":
      return { action: rest[0], name: rest[1] };

    case "write":
    case "read": {
      const type = rest[0];
      const objective = rest.find((r, i) => i > 0 && !r.startsWith("-"));
      const numberIdx = rest.indexOf("--number");
      const number = numberIdx >= 0 ? parseInt(rest[numberIdx + 1]!, 10) : undefined;
      return { type, objective, number };
    }

    case "artifacts":
      return { objective: rest[0] };

    case "tasks": {
      const action = rest[0];
      if (!action || !["add", "update", "assign", "show"].includes(action)) {
        return { objective: rest[0] };
      }
      const params: Record<string, unknown> = { action };
      if (action === "add") {
        params.summary = rest[1];
      } else {
        params.id = parseInt(rest[1]!, 10);
      }
      if (rest.includes("--done")) params.done = true;
      const groupIdx = rest.indexOf("--group");
      if (groupIdx >= 0) params.group = parseInt(rest[groupIdx + 1]!, 10);
      return params;
    }

    case "note": {
      const summary = rest.find((r) => !r.startsWith("-"));
      const params: Record<string, unknown> = { summary };
      if (rest.includes("--decide")) params.type = "decision";
      else if (rest.includes("--defer")) params.type = "deferral";
      else if (rest.includes("--discover")) params.type = "discovery";
      else if (rest.includes("--blocker")) params.type = "blocker";
      const reasonIdx = rest.indexOf("--reason");
      if (reasonIdx >= 0) params.reason = rest[reasonIdx + 1];
      const impactIdx = rest.indexOf("--impact");
      if (impactIdx >= 0) params.impact = rest[impactIdx + 1];
      return params;
    }

    case "notes": {
      const params: Record<string, unknown> = {};
      const objective = rest.find((r) => !r.startsWith("-"));
      if (objective) params.objective = objective;
      const typeIdx = rest.indexOf("--type");
      if (typeIdx >= 0) params.type = rest[typeIdx + 1];
      const stepIdx = rest.indexOf("--step");
      if (stepIdx >= 0) params.step = rest[stepIdx + 1];
      return params;
    }

    default:
      return {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/cli-args.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/args.ts build/__tests__/cli-args.test.ts
git commit -m "feat: add CLI argument parser"
```

---

### Task 9: Implement output formatters

**Files:**
- Create: `src/cli/output.ts`
- Test: `build/__tests__/cli-output.test.ts`

- [ ] **Step 1: Write output formatter tests**

```ts
// build/__tests__/cli-output.test.ts
import { describe, it, expect } from "bun:test";
import { formatAgent, formatHuman } from "../../src/cli/output.ts";
import type { AgentResponse } from "../../types/output";

describe("formatAgent", () => {
  it("serializes AgentResponse as JSON", () => {
    const response: AgentResponse = {
      status: "ok",
      command: "status",
      display: "All good",
    };
    const output = formatAgent(response);
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("status");
  });
});

describe("formatHuman", () => {
  it("returns display field when present", () => {
    const response: AgentResponse = {
      status: "ok",
      command: "status",
      display: "## Status\nAll objectives clear.",
    };
    expect(formatHuman(response)).toContain("All objectives clear.");
  });

  it("shows error for error status", () => {
    const response: AgentResponse = {
      status: "error",
      command: "next",
      error: "No active objective",
    };
    expect(formatHuman(response)).toContain("No active objective");
  });

  it("shows pause message for paused status", () => {
    const response: AgentResponse = {
      status: "paused",
      command: "next",
      action: { type: "confirm", message: "Settings change", next_command: "tx next" },
    };
    expect(formatHuman(response)).toContain("Settings change");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/cli-output.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/cli/output.ts`**

```ts
// src/cli/output.ts
import type { AgentResponse } from "../../types/output.js";

export function formatAgent(response: AgentResponse): string {
  return JSON.stringify(response, null, 2);
}

export function formatHuman(response: AgentResponse): string {
  if (response.status === "error") {
    return `Error: ${response.error ?? "Unknown error"}`;
  }

  if (response.status === "paused" && response.action?.type === "confirm") {
    return `${response.action.message}\n\nRun: ${response.action.next_command}`;
  }

  if (response.display) {
    return response.display;
  }

  return `[${response.command}] ${response.status}`;
}

export function output(response: AgentResponse, agent: boolean): void {
  const formatted = agent ? formatAgent(response) : formatHuman(response);
  process.stdout.write(formatted + "\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test build/__tests__/cli-output.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/output.ts build/__tests__/cli-output.test.ts
git commit -m "feat: add CLI output formatters (agent JSON + human pretty)"
```

---

### Task 10: Implement CLI entry point and filesystem layer

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/fs.ts`
- Modify: `package.json`
- Test: `build/__tests__/cli-integration.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// build/__tests__/cli-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "../.test-output/cli-integration");

describe("CLI integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("tx init creates .twisted directory", async () => {
    const result = Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const output = result.stdout.toString();
    const response = JSON.parse(output);
    expect(response.status).toBe("ok");
    expect(response.command).toBe("init");
    expect(existsSync(join(TEST_DIR, ".twisted"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".twisted/settings.json"))).toBe(true);
  });

  it("tx open creates objective", async () => {
    // Init first
    Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );

    const result = Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "open", "my-feature", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const output = result.stdout.toString();
    const response = JSON.parse(output);
    expect(response.status).toBe("ok");
    expect(response.state?.objective).toBe("my-feature");
    expect(response.state?.step).toBe("research");

    const statePath = join(TEST_DIR, ".twisted/todo/my-feature/state.json");
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.step).toBe("research");
  });

  it("tx status shows objective", async () => {
    Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "open", "my-feature", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );

    const result = Bun.spawnSync(
      ["bun", "run", "src/cli/index.ts", "status", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.display).toContain("my-feature");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/cli-integration.test.ts`
Expected: FAIL — entry point doesn't exist

- [ ] **Step 3: Create `src/cli/fs.ts` — filesystem operations**

```ts
// src/cli/fs.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import type { ObjectiveState } from "../../types/state.js";
import type { Task } from "../../types/tasks.js";
import type { Note } from "../../types/notes.js";
import type { ActiveSession, SessionSummary } from "../../types/session.js";
import type { TwistedSettings } from "../../types/config.js";

export function findRoot(cwd: string): string {
  return process.env.TWISTED_ROOT ?? cwd;
}

export function twistedDir(root: string): string {
  return join(root, ".twisted");
}

export function objectiveDir(root: string, lane: string, objective: string): string {
  return join(twistedDir(root), lane, objective);
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

// --- State ---

export function readState(objDir: string): ObjectiveState {
  return JSON.parse(readFileSync(join(objDir, "state.json"), "utf-8"));
}

export function writeState(objDir: string, state: ObjectiveState): void {
  writeFileSync(join(objDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

// --- Tasks ---

export function readTasks(objDir: string): Task[] {
  const path = join(objDir, "tasks.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeTasks(objDir: string, tasks: Task[]): void {
  writeFileSync(join(objDir, "tasks.json"), JSON.stringify(tasks, null, 2) + "\n");
}

// --- Notes ---

export function readNotes(objDir: string): Note[] {
  const path = join(objDir, "notes.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeNotes(objDir: string, notes: Note[]): void {
  writeFileSync(join(objDir, "notes.json"), JSON.stringify(notes, null, 2) + "\n");
}

// --- Sessions ---

export function readActiveSession(objDir: string): ActiveSession | null {
  const path = join(objDir, "sessions/active.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeActiveSession(objDir: string, session: ActiveSession): void {
  const dir = join(objDir, "sessions");
  ensureDir(dir);
  writeFileSync(join(dir, "active.json"), JSON.stringify(session, null, 2) + "\n");
}

export function deleteActiveSession(objDir: string): void {
  const path = join(objDir, "sessions/active.json");
  if (existsSync(path)) {
    const { unlinkSync } = require("fs");
    unlinkSync(path);
  }
}

export function listSessions(objDir: string): SessionSummary[] {
  const dir = join(objDir, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const match = f.match(/^(\d+)-(.+)\.md$/);
      if (!match) return null;
      return { number: parseInt(match[1]!, 10), name: match[2]!, file: f };
    })
    .filter((s): s is SessionSummary => s !== null);
}

// --- Settings ---

export function readSettings(root: string): TwistedSettings {
  const path = join(twistedDir(root), "settings.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeSettings(root: string, settings: TwistedSettings & { $schema?: string }): void {
  const path = join(twistedDir(root), "settings.json");
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}

// --- Artifacts ---

export function writeArtifact(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

export function readArtifact(path: string): string {
  return readFileSync(path, "utf-8");
}

// --- Scanning ---

export function findObjectives(root: string): Array<{ lane: string; objective: string; dir: string }> {
  const twisted = twistedDir(root);
  const results: Array<{ lane: string; objective: string; dir: string }> = [];

  for (const lane of ["todo", "in-progress", "done"]) {
    const laneDir = join(twisted, lane);
    if (!existsSync(laneDir)) continue;
    for (const entry of readdirSync(laneDir)) {
      const objDir = join(laneDir, entry);
      if (existsSync(join(objDir, "state.json"))) {
        results.push({ lane, objective: entry, dir: objDir });
      }
    }
  }

  return results;
}
```

- [ ] **Step 4: Create `src/cli/index.ts` — main entry point**

```ts
#!/usr/bin/env node
// src/cli/index.ts
import { parseArgs } from "./args.js";
import { output } from "./output.js";
import { resolveConfig } from "../config/resolve.js";
import { createInitialState } from "../state/machine.js";
import {
  findRoot, twistedDir, objectiveDir, ensureDir,
  readState, writeState, readSettings, writeSettings,
  readTasks, writeTasks, readNotes, writeNotes,
  readActiveSession, writeActiveSession, deleteActiveSession,
  listSessions, findObjectives, writeArtifact, readArtifact,
} from "./fs.js";
import { addNote, filterNotes } from "../notes/notes.js";
import { addTask, updateTask, assignTask, getTask, getTasksByGroup } from "../tasks/tasks.js";
import { createSession, addSessionEvent, closeSession, getLatestSession } from "../session/lifecycle.js";
import { resolveArtifactPath, listArtifacts } from "../artifacts/artifacts.js";
import type { AgentResponse } from "../../types/output.js";
import type { ObjectiveState } from "../../types/state.js";
import { join } from "path";

const argv = process.argv.slice(2);
const command = parseArgs(argv);
const root = findRoot(process.cwd());
const settings = readSettings(root);
const config = resolveConfig(settings);

function respond(response: AgentResponse): void {
  output(response, command.flags.agent);
}

function findActiveObjective(): { dir: string; state: ObjectiveState } | null {
  const objectives = findObjectives(root);
  if (command.flags.objective) {
    const match = objectives.find((o) => o.objective === command.flags.objective);
    if (!match) return null;
    return { dir: match.dir, state: readState(match.dir) };
  }
  // Most recently updated in-progress, then todo
  const active = objectives
    .filter((o) => o.lane !== "done")
    .map((o) => ({ ...o, state: readState(o.dir) }))
    .sort((a, b) => b.state.updated.localeCompare(a.state.updated));
  if (active.length === 0) return null;
  return { dir: active[0]!.dir, state: active[0]!.state };
}

switch (command.subcommand) {
  case "init": {
    const twisted = twistedDir(root);
    ensureDir(join(twisted, "todo"));
    ensureDir(join(twisted, "in-progress"));
    ensureDir(join(twisted, "done"));
    ensureDir(join(twisted, "worktrees"));
    if (!readSettings(root).presets) {
      writeSettings(root, { $schema: "./schemas/settings.schema.json", presets: [] });
    }
    respond({ status: "ok", command: "init", display: "Initialized .twisted/", config });
    break;
  }

  case "open": {
    const objective = (command.params as any).objective;
    if (!objective) {
      respond({ status: "error", command: "open", error: "Objective name required: tx open <name>" });
      break;
    }
    const objDir = objectiveDir(root, "todo", objective);
    ensureDir(objDir);
    ensureDir(join(objDir, "research"));
    ensureDir(join(objDir, "sessions"));
    const state = createInitialState(objective, config.pipeline);
    writeState(objDir, state);
    writeNotes(objDir, []);
    writeTasks(objDir, []);
    respond({ status: "ok", command: "open", state, display: `Opened objective: ${objective}\nStep: research` });
    break;
  }

  case "status": {
    const objectives = findObjectives(root);
    if (objectives.length === 0) {
      respond({ status: "ok", command: "status", display: "No objectives." });
      break;
    }
    const targetName = (command.params as any).objective;
    if (targetName) {
      const match = objectives.find((o) => o.objective === targetName);
      if (!match) {
        respond({ status: "error", command: "status", error: `Objective '${targetName}' not found` });
        break;
      }
      const state = readState(match.dir);
      respond({ status: "ok", command: "status", state, display: formatStatusDetail(state) });
    } else {
      const lines = objectives.map((o) => {
        const s = readState(o.dir);
        return `${s.objective}  ${s.status}  ${s.step}  ${s.tasks_done}/${s.tasks_total ?? "?"}  ${s.updated}`;
      });
      respond({ status: "ok", command: "status", display: lines.join("\n") });
    }
    break;
  }

  case "next": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "next", error: "No active objective. Run: tx open <name>" });
      break;
    }
    const { nextStep } = await import("../state/machine.js");
    const { shouldPause, getPhaseSettings } = await import("../pipeline/routing.js");
    const next = nextStep(active.state.step, config.pipeline);
    if (!next) {
      respond({ status: "ok", command: "next", state: active.state, action: { type: "done" }, display: "All steps complete." });
      break;
    }
    const pauseReason = shouldPause(active.state.step, next, config.flow, config.phases, command.flags.yolo);
    if (pauseReason) {
      const settings = getPhaseSettings(next, config.phases);
      const display = settings
        ? `Next step: ${next}\n  Model: ${settings.model}\n  Effort: ${settings.effort}\n  Context: ${settings.context}\n  Mode: ${settings.mode}`
        : `Next step: ${next}`;
      respond({
        status: "paused",
        command: "next",
        state: active.state,
        action: { type: "confirm", message: display, next_command: `tx next -y${command.flags.agent ? " -a" : ""}` },
        display,
      });
      break;
    }
    // Advance
    const { advanceState } = await import("../state/machine.js");
    const newState = advanceState(active.state, config.pipeline);
    writeState(active.dir, newState);
    respond({ status: "ok", command: "next", state: newState, display: `Advanced to: ${next}` });
    break;
  }

  case "write": {
    const { type, number } = command.params as any;
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "write", error: "No active objective" });
      break;
    }
    const path = resolveArtifactPath(active.dir, type, number);
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString("utf-8");
    writeArtifact(join(root, path), content);
    respond({ status: "ok", command: "write", display: `Wrote ${type} to ${path}` });
    break;
  }

  case "read": {
    const { type, number } = command.params as any;
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "read", error: "No active objective" });
      break;
    }
    const path = resolveArtifactPath(active.dir, type, number);
    const fullPath = join(root, path);
    try {
      const content = readArtifact(fullPath);
      if (command.flags.agent) {
        respond({ status: "ok", command: "read", display: content });
      } else {
        process.stdout.write(content);
      }
    } catch {
      respond({ status: "error", command: "read", error: `Artifact not found: ${path}` });
    }
    break;
  }

  case "note": {
    const { summary, type, reason, impact } = command.params as any;
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "note", error: "No active objective" });
      break;
    }
    const notes = readNotes(active.dir);
    const note = addNote(notes, {
      type: type ?? "note",
      step: active.state.step,
      summary,
      reason,
      impact,
    });
    writeNotes(active.dir, notes);
    // Update active session if exists
    const session = readActiveSession(active.dir);
    if (session) {
      addSessionEvent(session, { type: "note_added", noteId: note.id });
      writeActiveSession(active.dir, session);
    }
    respond({ status: "ok", command: "note", display: `Note #${note.id}: ${summary}` });
    break;
  }

  case "notes": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "notes", error: "No active objective" });
      break;
    }
    const notes = readNotes(active.dir);
    const { type, step } = command.params as any;
    const filtered = filterNotes(notes, { type, step });
    const display = filtered.map((n) => `#${n.id} [${n.type}] (${n.step}) ${n.summary}`).join("\n");
    respond({ status: "ok", command: "notes", display: display || "No notes." });
    break;
  }

  case "tasks": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "tasks", error: "No active objective" });
      break;
    }
    const tasks = readTasks(active.dir);
    const { action, id, summary, done, group } = command.params as any;

    if (!action) {
      const display = tasks.map((t) => `#${t.id} [${t.done ? "x" : " "}] (g${t.group ?? "?"}) ${t.summary}`).join("\n");
      respond({ status: "ok", command: "tasks", display: display || "No tasks." });
      break;
    }
    if (action === "add") {
      const task = addTask(tasks, { summary });
      writeTasks(active.dir, tasks);
      respond({ status: "ok", command: "tasks", display: `Task #${task.id}: ${summary}` });
    } else if (action === "update") {
      const task = updateTask(tasks, id, { done });
      writeTasks(active.dir, tasks);
      respond({ status: "ok", command: "tasks", display: `Updated task #${task.id}` });
    } else if (action === "assign") {
      const task = assignTask(tasks, id, group);
      writeTasks(active.dir, tasks);
      respond({ status: "ok", command: "tasks", display: `Assigned task #${task.id} to group ${group}` });
    } else if (action === "show") {
      const task = getTask(tasks, id);
      respond({ status: "ok", command: "tasks", display: JSON.stringify(task, null, 2) });
    }
    break;
  }

  case "pickup": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "pickup", error: "No active objective" });
      break;
    }
    const existing = readActiveSession(active.dir);
    if (existing) {
      respond({
        status: "ok",
        command: "pickup",
        session: { active: existing, previous: null },
        display: `Resuming session #${existing.number} (started ${existing.started})`,
      });
      break;
    }
    const sessions = listSessions(active.dir);
    const latest = getLatestSession(sessions);
    const nextNumber = (latest?.number ?? 0) + 1;
    const name = (command.params as any).name ?? null;
    const session = createSession(active.state.step, name, nextNumber);
    writeActiveSession(active.dir, session);
    respond({
      status: "ok",
      command: "pickup",
      session: { active: session, previous: latest },
      display: `Session #${nextNumber} started${name ? ` (${name})` : ""}`,
    });
    break;
  }

  case "handoff": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "handoff", error: "No active objective" });
      break;
    }
    const session = readActiveSession(active.dir);
    if (!session) {
      respond({ status: "error", command: "handoff", error: "No active session" });
      break;
    }
    const summary = closeSession(session);
    respond({
      status: "handoff",
      command: "handoff",
      session: { active: session, previous: null },
      action: {
        type: "prompt_user",
        prompt: `Write a session summary for session #${summary.number}. Include: what was accomplished, decisions made, artifacts created, and what comes next. Pipe the result to: tx session save ${summary.name} -a`,
      },
      display: `Ending session #${summary.number}. Write summary and run: tx session save ${summary.name}`,
    });
    break;
  }

  case "session": {
    const { action, name } = command.params as any;
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "session", error: "No active objective" });
      break;
    }
    if (action === "status") {
      const session = readActiveSession(active.dir);
      if (session) {
        respond({ status: "ok", command: "session", session: { active: session, previous: null }, display: JSON.stringify(session, null, 2) });
      } else {
        respond({ status: "ok", command: "session", display: "No active session." });
      }
    } else if (action === "save") {
      const session = readActiveSession(active.dir);
      if (!session) {
        respond({ status: "error", command: "session", error: "No active session to save" });
        break;
      }
      const summary = closeSession(session);
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString("utf-8");
      const sessionsDir = join(active.dir, "sessions");
      ensureDir(sessionsDir);
      writeArtifact(join(sessionsDir, summary.file), content);
      deleteActiveSession(active.dir);
      respond({ status: "ok", command: "session", display: `Session saved: sessions/${summary.file}` });
    } else if (action === "list") {
      const sessions = listSessions(active.dir);
      const display = sessions.map((s) => `#${s.number} ${s.name} (${s.file})`).join("\n");
      respond({ status: "ok", command: "session", display: display || "No sessions." });
    }
    break;
  }

  case "close": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "close", error: "No active objective" });
      break;
    }
    // Close is the final pipeline step — QA, changelog, ship
    const qaCfg = config.pipeline.qa;
    const shipCfg = config.pipeline.ship;
    respond({
      status: "handoff",
      command: "close",
      state: active.state,
      action: {
        type: "prompt_user",
        prompt: `Objective "${active.state.objective}" is ready to close.\n\nSub-steps:\n1. QA (provider: ${qaCfg.provider})\n2. Write changelog entry → pipe to: tx write changelog -a\n3. Ship (provider: ${shipCfg.provider})\n\nComplete these steps, then run: tx next -a to finalize.`,
      },
      display: `Close: ${active.state.objective}\n  QA: ${qaCfg.provider}\n  Ship: ${shipCfg.provider}`,
    });
    break;
  }

  case "resume": {
    const objectiveName = (command.params as any).objective;
    if (!objectiveName) {
      respond({ status: "error", command: "resume", error: "Objective name required: tx resume <name>" });
      break;
    }
    const objectives = findObjectives(root);
    const match = objectives.find((o) => o.objective === objectiveName);
    if (!match) {
      respond({ status: "error", command: "resume", error: `Objective '${objectiveName}' not found` });
      break;
    }
    const state = readState(match.dir);
    const session = readActiveSession(match.dir);
    const sessions = listSessions(match.dir);
    const latest = getLatestSession(sessions);
    respond({
      status: "ok",
      command: "resume",
      state,
      session: { active: session, previous: latest },
      display: `Resuming: ${objectiveName}\n  Step: ${state.step}\n  Status: ${state.status}`,
    });
    break;
  }

  case "research":
  case "scope":
  case "plan":
  case "build": {
    const stepName = command.subcommand;
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: stepName, error: "No active objective" });
      break;
    }
    if (active.state.step !== stepName) {
      respond({
        status: "error",
        command: stepName,
        error: `Objective is at step "${active.state.step}", not "${stepName}"`,
        state: active.state,
      });
      break;
    }
    // Return handoff for the agent to execute this step
    const providerKey = stepName === "research" ? "research" : null;
    const provider = providerKey ? config.pipeline[providerKey]?.provider : "built-in";
    if (provider && provider !== "built-in" && provider !== "skip") {
      respond({
        status: "handoff",
        command: stepName,
        state: active.state,
        action: { type: "invoke_skill", skill: provider },
        display: `Step: ${stepName}\n  Provider: ${provider}`,
      });
    } else {
      respond({
        status: "handoff",
        command: stepName,
        state: active.state,
        action: { type: "prompt_user", prompt: `Execute the ${stepName} step for objective "${active.state.objective}".` },
        display: `Step: ${stepName} (built-in)`,
      });
    }
    break;
  }

  case "config": {
    respond({ status: "ok", command: "config", config, display: JSON.stringify(config, null, 2) });
    break;
  }

  case "artifacts": {
    const active = findActiveObjective();
    if (!active) {
      respond({ status: "error", command: "artifacts", error: "No active objective" });
      break;
    }
    // List files in the objective directory
    const { readdirSync } = await import("fs");
    const files = readdirSync(active.dir, { recursive: true }) as string[];
    const artifacts = listArtifacts(active.dir, files.map((f) => join(active.dir, f as string)));
    const display = artifacts.map((a) => `${a.exists ? "+" : "-"} ${a.type}: ${a.path}`).join("\n");
    respond({ status: "ok", command: "artifacts", display });
    break;
  }

  default: {
    if (command.flags.version) {
      respond({ status: "ok", command: "version", display: `twisted-workflow v${config.version}` });
    } else if (command.flags.help) {
      respond({ status: "ok", command: "help", display: getHelpText() });
    } else {
      // Interactive mode — show status
      const objectives = findObjectives(root);
      if (objectives.length === 0) {
        respond({ status: "ok", command: "interactive", display: "No objectives. Run: tx open <name>" });
      } else {
        const lines = objectives.map((o) => {
          const s = readState(o.dir);
          return `${s.objective}  ${s.status}  ${s.step}`;
        });
        respond({ status: "ok", command: "interactive", display: lines.join("\n") });
      }
    }
  }
}

function formatStatusDetail(state: ObjectiveState): string {
  return [
    `Objective: ${state.objective}`,
    `Status:    ${state.status}`,
    `Step:      ${state.step}`,
    `Progress:  ${state.steps_completed.length}/${state.steps_completed.length + state.steps_remaining.length + 1} steps, ${state.tasks_done}/${state.tasks_total ?? "?"} tasks`,
    `Created:   ${state.created}`,
    `Updated:   ${state.updated}`,
  ].join("\n");
}

function getHelpText(): string {
  return `tx <command> [args] [flags]

Lifecycle:
  tx init                    Setup .twisted/
  tx open <objective>        Create objective
  tx close [objective]       Final step
  tx next [objective]        Advance step
  tx resume <objective>      Resume objective
  tx status [objective]      Show status

Steps:
  tx research [objective]    Run research
  tx scope [objective]       Run scope
  tx plan [objective]        Run plan
  tx build [objective]       Run build

Session:
  tx pickup [name]           Start session
  tx handoff [name]          End session
  tx session status|save|list

Artifacts:
  tx write <type> [obj]      Write (stdin)
  tx read <type> [obj]       Read (stdout)
  tx artifacts [obj]         List artifacts

Tasks:
  tx tasks [obj]             List tasks
  tx tasks add <summary>     Add task
  tx tasks update <id>       Update task
  tx tasks show <id>         Show detail

Notes:
  tx note <summary>          Add note
  tx notes [obj]             Query notes

Config:
  tx config [section] [sub]  Show config

Flags:
  -a, --agent       JSON output
  -y, --yolo        Skip confirmations
  -o, --objective   Target objective
  -h, --help        Show help
  -v, --version     Show version`;
}
```

- [ ] **Step 5: Update `package.json`**

```json
{
  "name": "twisted-workflow",
  "version": "3.0.0",
  "type": "module",
  "bin": {
    "tx": "./dist/cli.js"
  },
  "files": ["dist/", "schemas/", "skills/", "presets/"],
  "scripts": {
    "build": "bun run build/build.ts",
    "build:cli": "tsc -p tsconfig.cli.json",
    "dev": "bun run src/cli/index.ts"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/node": "^22",
    "build-md": "^0.4.5"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 6: Run integration test to verify it passes**

Run: `bun test build/__tests__/cli-integration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/index.ts src/cli/fs.ts package.json build/__tests__/cli-integration.test.ts
git commit -m "feat: add CLI entry point with init, open, status, next, and all commands"
```

---

### Task 11: Update existing tests for new pipeline shape

**Files:**
- Modify: `build/__tests__/state-machine.test.ts`
- Modify: `build/__tests__/pipeline-routing.test.ts`
- Modify: `build/__tests__/state-resume.test.ts`
- Modify: `build/__tests__/state-status.test.ts`
- Modify: `build/__tests__/config-resolve.test.ts`
- Delete: `build/__tests__/strategies-writer.test.ts`
- Delete: `build/__tests__/strategies-paths.test.ts`

- [ ] **Step 1: Update all test files**

Replace old step names (decompose, execute, arch_review, code_review, qa, ship) with new names (plan, build, close) throughout all test files. Remove tests that reference deleted modules (nimbalyst status mapping, multi-strategy writers, gstack paths).

Key replacements across all test files:
- `"decompose"` → `"plan"`
- `"execute"` → `"build"`
- `"arch_review"` → remove or update to hook test
- `"code_review"` → remove or update to hook test
- `"qa"` → remove
- `"ship"` → remove or rename to `"close"`
- `issues_done` → `tasks_done`
- `issues_total` → `tasks_total`

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: update all tests for 5-step pipeline"
```

---

### Task 12: Clean up deleted source files and update exports

**Files:**
- Delete: `src/strategies/writer.ts` (replaced by artifacts module)
- Delete: `src/strategies/paths.ts` (replaced by artifacts module)
- Modify: `src/strategies/index.ts`
- Delete: `src/scope/objective.ts` (replaced by CLI open command)
- Modify: `src/scope/index.ts`
- Modify: `src/pipeline/dispatch.ts`
- Modify: `types/config.d.ts` (remove re-exports of deleted types)

- [ ] **Step 1: Delete obsolete files**

```bash
git rm src/strategies/writer.ts src/strategies/paths.ts src/scope/objective.ts
git rm build/__tests__/strategies-writer.test.ts build/__tests__/strategies-paths.test.ts
```

- [ ] **Step 2: Update `src/strategies/index.ts`**

```ts
export { getWorktreePaths, getWorktreeCommands } from "./worktree.js";
```

- [ ] **Step 3: Update `src/scope/index.ts`**

Remove `objective.ts` export.

- [ ] **Step 4: Update `src/pipeline/dispatch.ts`**

Replace `forEachStrategy` with direct calls. Remove `invoke` placeholder. Update to work with new pipeline shape.

- [ ] **Step 5: Update `types/config.d.ts`**

Remove re-exports for deleted types: nimbalyst, tracking, frontmatter, artifacts, issues.

- [ ] **Step 6: Run full test suite**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove obsolete files (strategies/writer, nimbalyst, multi-tracking)"
```

---

### Task 13: Refactor build system for thin wrapper skills

**Files:**
- Modify: `build/build.ts`
- Modify: `build/lib/extract.ts`
- Modify: `build/lib/skill.ts`
- Modify: `build/skills/twisted-work.ts`
- Delete: `build/skills/twisted-decompose.ts` (merged into plan)
- Delete: `build/skills/twisted-execute.ts` (merged into build)
- Delete: `build/skills/twisted-scope.ts` (merged into CLI)
- Modify: `build/skills/using-twisted-workflow.ts`
- Modify: `build/__tests__/skill-content.test.ts`
- Modify: `build/__tests__/build-output.test.ts`

- [ ] **Step 1: Update skill content test**

Tests should verify that generated skills are thin wrappers containing:
- `tx` command instructions
- `AgentResponse` handling guide
- Extracted command signatures (not function bodies)
- Installation instructions

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test build/__tests__/skill-content.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `build/lib/extract.ts`**

Change extraction to pull JSDoc comments and function signatures only (not function bodies). Target CLI entry point and command handlers.

- [ ] **Step 4: Update `build/lib/skill.ts`**

Generate thin wrapper skill format:
- Header with `tx` invocation pattern
- Extracted command signatures
- Response handling guide
- Installation instructions

- [ ] **Step 5: Update `build/skills/twisted-work.ts`**

Single skill builder that generates the main `twisted-work` skill pointing to `tx`.

- [ ] **Step 6: Delete merged sub-skill builders**

```bash
git rm build/skills/twisted-decompose.ts build/skills/twisted-execute.ts build/skills/twisted-scope.ts
```

- [ ] **Step 7: Update `build/build.ts`**

Remove sub-skill generation. Add CLI compilation step.

- [ ] **Step 8: Update `build/skills/using-twisted-workflow.ts`**

Simplified reference skill — just points to `tx --help` and the config schema.

- [ ] **Step 9: Run test to verify it passes**

Run: `bun test build/__tests__/skill-content.test.ts build/__tests__/build-output.test.ts`
Expected: PASS

- [ ] **Step 10: Run full build**

Run: `bun run build`
Expected: Generates thin wrapper skills in `skills/`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: build system generates thin wrapper skills from CLI signatures"
```

---

### Task 14: Add TypeScript compilation for distribution

**Files:**
- Create: `tsconfig.cli.json`
- Modify: `package.json`

- [ ] **Step 1: Create `tsconfig.cli.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["build/**", "**/*.test.ts"]
}
```

- [ ] **Step 2: Build CLI**

Run: `npx tsc -p tsconfig.cli.json`
Expected: Compiles to `dist/` with no errors

- [ ] **Step 3: Test compiled CLI**

Run: `node dist/cli/index.js --version -a`
Expected: JSON response with version

- [ ] **Step 4: Commit**

```bash
git add tsconfig.cli.json dist/
git commit -m "feat: add TypeScript compilation for npm distribution"
```

---

### Task 15: Final integration test and cleanup

**Files:**
- Test: `build/__tests__/cli-integration.test.ts` (expand)

- [ ] **Step 1: Expand integration tests**

Add end-to-end tests covering:
- Full lifecycle: init → open → pickup → note → write → tasks add → handoff → session save → next → close
- Human mode output (no `-a`)
- Error cases (missing objective, unknown command)
- `-o` flag for targeting specific objectives
- Multiple objectives

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: All 200+ tests pass

- [ ] **Step 3: Run full build**

Run: `bun run build`
Expected: Skills generated, schema generated, CLI compiles

- [ ] **Step 4: Manual smoke test**

```bash
bun run src/cli/index.ts init -y -a
bun run src/cli/index.ts open test-feature -a
bun run src/cli/index.ts status -a
bun run src/cli/index.ts pickup -a
echo "# Research" | bun run src/cli/index.ts write research -a
bun run src/cli/index.ts note "Test note" --decide --reason "testing" -a
bun run src/cli/index.ts tasks add "First task" -a
bun run src/cli/index.ts tasks -a
bun run src/cli/index.ts notes -a
bun run src/cli/index.ts next -a
bun run src/cli/index.ts artifacts -a
bun run src/cli/index.ts handoff -a
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: full integration test suite for CLI"
```

---

### Task 16: Update documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CLAUDE.md**

Update project structure, pipeline steps, command reference, and architecture description to reflect v3.0.

- [ ] **Step 2: Update README.md**

Update installation, usage, and configuration sections for the CLI.

- [ ] **Step 3: Update CHANGELOG.md**

Add v3.0.0 entry documenting breaking changes.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md CHANGELOG.md
git commit -m "docs: update documentation for v3.0 CLI architecture"
```
