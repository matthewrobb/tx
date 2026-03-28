---
name: using-twisted-workflow
description: Use when any twisted-workflow skill is active — provides shared config, defaults, state machine, tracking strategies, and pipeline routing
---

# twisted-workflow shared config

Loaded automatically by `/twisted-work` and passed to internal sub-skills. This is the reference for all shared logic.

---

## Built-in Defaults

```typescript
export const defaults: TwistedConfig = {
  version: "2.0",
  presets: [],
  tracking: ["twisted"],

  tools: {
    detected: {
      gstack: false,
      superpowers: false,
      nimbalyst_skills: false,
    },
    last_scan: null,
  },

  pipeline: {
    research: { provider: "built-in", fallback: "built-in", options: {} },
    arch_review: { provider: "skip", fallback: "skip", options: {} },
    code_review: { provider: "built-in", fallback: "built-in", options: {} },
    qa: { provider: "skip", fallback: "skip", options: {} },
    ship: { provider: "built-in", fallback: "built-in", options: {} },
  },

  execution: {
    strategy: "task-tool",
    discipline: null,
    worktree_tiers: 2,
    group_parallel: true,
    merge_strategy: "normal",
    review_frequency: "after-all",
    test_requirement: "must-pass",
  },

  phases: {
    scope: { model: "opus", effort: "max", context: "default", mode: "execute" },
    decompose: { model: "opus", effort: "max", context: "default", mode: "plan" },
    execute: { model: "sonnet", effort: "medium", context: "1m", mode: "execute" },
  },

  decompose: {
    estimation: "fibonacci",
    batch_threshold: 2,
    split_threshold: 8,
    categories: ["scope", "behavior", "constraints", "acceptance"],
  },

  templates: {
    issue: {
      fields: [
        { name: "id", format: "ISSUE-{id}" },
        { name: "title", type: "string" },
        { name: "type", type: "enum", values: ["bug", "refactor", "feature", "test"] },
        { name: "area", type: "string" },
        { name: "file", type: "string" },
        { name: "current_state", type: "string" },
        { name: "target_state", type: "string" },
        { name: "dependencies", type: "list" },
        { name: "group", type: "number" },
        { name: "complexity", type: "number" },
        { name: "done", type: "checkbox" },
      ],
    },
    changelog_entry: [
      "## {date} — {objective}",
      "### Completed",
      "{completed}",
      "### Deferred",
      "{deferred}",
      "### Decisions",
      "{decisions}",
    ],
  },

  state: {
    use_folders: true,
    folder_kanban: {
      todo: ".twisted/todo",
      in_progress: ".twisted/in-progress",
      done: ".twisted/done",
    },
  },

  flow: {
    auto_advance: true,
    pause_on_config_change: true,
    pause_on_low_context: true,
  },

  writing: {
    skill: "writing-clearly-and-concisely",
    fallback: true,
  },

  nimbalyst: {
    default_priority: "medium",
    default_owner: "claude",
  },

  directories: {
    root: ".twisted",
    worktrees: ".twisted/worktrees",
  },

  files: {
    settings: ".twisted/settings.json",
    changelog: "CHANGELOG.md",
    changelog_sort: "newest-first",
  },

  naming: {
    strategy: "prefix",
    increment_padding: 3,
  },

  strings: {
    commit_messages: {
      init: "chore: add twisted workflow",
      plan: "chore: add {objective} research and plan",
      done: "chore: complete {objective}",
      lane_move: "chore: move {objective} from {from} to {to}",
      group_merge: "feat({objective}): complete group {group}",
    },
    status_line: "{objective}  {status}  {step}  {progress}  {updated}",
    status_detail: [
      "Objective: {objective}",
      "Status:    {status}",
      "Step:      {step}",
      "Progress:  {steps_completed}/{steps_remaining} steps, {issues_done}/{issues_total} issues",
      "Group:     {group_current}/{groups_total}",
      "Created:   {created}",
      "Updated:   {updated}",
    ].join("\n"),
    phase_recommendation: [
      "Next step: {step}",
      "  Model:   {model}",
      "  Effort:  {effort}",
      "  Context: {context}",
      "  Mode:    {mode}",
    ].join("\n"),
    research_section: "## Agent {n} — {focus}",
    handoff_messages: {
      research_to_scope: "Research complete ({research_count} agents). Starting scope.",
      scope_to_decompose: "Requirements captured across {category_count} categories. Starting decomposition.",
      decompose_to_execute: "{issue_count} issues in {group_count} groups ({agent_count} agents). Ready to execute.",
      execute_to_review: "Execution complete ({issues_done}/{issues_total} issues). Starting review.",
      review_to_ship: "Review passed. Ready to ship.",
      ship_done: "Objective {objective} complete.",
    },
    research_agent_prompt: [
      'Research the codebase for objective "{objective}".',
      "Focus area: {focus}",
      "Codebase context: {codebase_context}",
      "",
      "Return structured findings: key files, patterns, concerns.",
    ].join("\n"),
    execution_agent_prompt: [
      'Implement the following issues for objective "{objective}":',
      "",
      "Issue IDs: {issue_ids}",
      "{issue_details}",
      "",
      "Work in worktree: {worktree_path}",
      "Branch: {branch_name}",
      "Test requirement: {test_requirement}",
      "{discipline}",
      "",
      "Commit your implementation. Mark issues as done. Report results.",
    ].join("\n"),
    interrogation_prompt:
      "Let's drill into {category}. Tell me everything about this area — be specific and concrete. I will push back on anything vague.",
    changelog_entry: [
      "## {date} — {objective}",
      "### Completed",
      "{completed}",
      "### Deferred",
      "{deferred}",
      "### Decisions",
      "{decisions}",
    ],
  },

  context_skills: [],
};
```
## Config Resolution

```typescript
/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @param presetRegistry - Map of preset names → overrides (defaults to built-in presets)
 * @returns Fully resolved TwistedConfig with no missing fields
 */
export function resolveConfig(
  settings: TwistedSettings = {},
  presetRegistry: Record<string, PresetOverrides> = allPresets,
): TwistedConfig {
  // Extract preset names from settings
  const presetNames = settings.presets ?? [];

  // Load presets — unknown names are silently skipped
  const presetOverrides = presetNames
    .map((name) => presetRegistry[name])
    .filter((p): p is PresetOverrides => p !== undefined);

  // Apply right-to-left so the first preset has highest priority
  const reversedPresets = [...presetOverrides].reverse();

  // Extract project settings (everything except presets)
  const { presets: _, ...projectSettings } = settings;

  // 3-layer merge
  return deepMerge(
    defaults,
    ...reversedPresets,
    projectSettings as Partial<TwistedConfig>,
  );
}
```
## Presets

| Preset | What it overrides |
| --- | --- |
| `twisted` | tracking → twisted artifact format |
| `superpowers` | TDD discipline, code review → Superpowers |
| `gstack` | tracking → gstack, all delegatable phases → gstack commands |
| `nimbalyst` | tracking → nimbalyst, research + code review → Nimbalyst |
| `minimal` | all delegatable phases → skip, tests deferred |
First preset wins on conflict. Compose in any order:
- `["superpowers", "gstack"]` → Superpowers wins for code review, gstack fills the rest
- `["gstack", "superpowers"]` → gstack wins for code review, TDD still active


---

## State Machine

```typescript
/**
 * Full pipeline step sequence in execution order.
 * Delegatable steps may be skipped based on provider config.
 */
export const PIPELINE_ORDER: readonly ObjectiveStep[] = [
  "research",
  "scope",
  "arch_review",
  "decompose",
  "execute",
  "code_review",
  "qa",
  "ship",
] as const;
```
```typescript
/**
 * Advance the state to the next step.
 * Returns a new state object (immutable).
 */
export function advanceState(
  state: ObjectiveState,
  pipeline: PipelineConfig,
  provider?: string,
): ObjectiveState {
  const next = nextStep(state.step, pipeline);

  if (!next) {
    // Final step complete — mark as done
    return {
      ...state,
      status: "done",
      steps_completed: [...state.steps_completed, state.step],
      steps_remaining: [],
      updated: new Date().toISOString(),
      tools_used: provider
        ? { ...state.tools_used, [state.step]: provider }
        : state.tools_used,
    };
  }

  const newStatus = statusForStep(next);

  return {
    ...state,
    status: newStatus,
    step: next,
    steps_completed: [...state.steps_completed, state.step],
    steps_remaining: stepsRemaining(next, pipeline),
    updated: new Date().toISOString(),
    tools_used: provider
      ? { ...state.tools_used, [state.step]: provider }
      : state.tools_used,
  };
}
```
```typescript
/**
 * Create the initial ObjectiveState for a new objective.
 */
export function createInitialState(
  objective: string,
  pipeline: PipelineConfig,
): ObjectiveState {
  const effective = getEffectiveSteps(pipeline);
  const firstStep = effective[0] ?? "scope";

  return {
    objective,
    status: "todo",
    step: firstStep,
    steps_completed: [],
    steps_remaining: effective.slice(1),
    group_current: null,
    groups_total: null,
    issues_done: 0,
    issues_total: null,
    created: new Date().toISOString().split("T")[0]!,
    updated: new Date().toISOString(),
    tools_used: {},
  };
}
```
## Status Mapping (Nimbalyst)

```typescript
// ---------------------------------------------------------------------------
// Nimbalyst status mapping
// ---------------------------------------------------------------------------

/**
 * Map twisted-workflow state to Nimbalyst plan status.
 */
export function toNimbalystStatus(
  status: ObjectiveStatus,
  step: ObjectiveStep,
): NimbalystStatus {
  if (status === "blocked") return "blocked";
  if (status === "done") return "completed";

  switch (step) {
    case "research":
    case "scope":
      return "draft";
    case "arch_review":
    case "decompose":
      return "ready-for-development";
    case "execute":
      return "in-development";
    case "code_review":
    case "qa":
      return "in-review";
    case "ship":
      return "in-review";
    default:
      return "draft";
  }
}
```
```typescript
/**
 * Infer Nimbalyst planType from objective content.
 * Falls back to "feature" if no specific type is detected.
 */
export function inferPlanType(description: string): NimbalystPlanType {
  const lower = description.toLowerCase();
  if (lower.includes("bug") || lower.includes("fix")) return "bug-fix";
  if (lower.includes("refactor") || lower.includes("restructure")) return "refactor";
  if (lower.includes("architect") || lower.includes("system design")) return "system-design";
  if (lower.includes("research") || lower.includes("investigate")) return "research";
  return "feature";
}
```

---

## Tracking Strategies

```typescript
/**
 * Get artifact paths for a given strategy and objective.
 */
export function getArtifactPaths(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
): ArtifactPaths {
  switch (strategy) {
    case "twisted":
      return {
        research: (n: number) => `${objDir}/RESEARCH-${n}.md`,
        requirements: `${objDir}/REQUIREMENTS.md`,
        plan: `${objDir}/PLAN.md`,
        issues: `${objDir}/ISSUES.md`,
        tracker: null,
        design: null,
      };

    case "nimbalyst":
      // objDir unused — nimbalyst paths are project-relative
      // objective encoded in filename, not directory
      return {
        research: `nimbalyst-local/plans/${objective}.md`,
        requirements: `nimbalyst-local/plans/${objective}.md`,
        plan: `nimbalyst-local/plans/${objective}.md`,
        issues: null, // issues embedded as checklist in plan doc
        tracker: `nimbalyst-local/tracker/tasks.md`,
        design: null,
      };

    case "gstack":
      return {
        research: `${objDir}/DESIGN.md`,
        requirements: `${objDir}/DESIGN.md`,
        plan: `${objDir}/PLAN.md`,
        issues: `${objDir}/ISSUES.md`, // always written for execute
        tracker: null,
        design: `${objDir}/DESIGN.md`,
      };

    default:
      // Unknown strategy falls back to twisted
      return getArtifactPaths("twisted", objective, objDir);
  }
}
```
### Strategy Artifact Map

| Step | twisted | nimbalyst | gstack |
| --- | --- | --- | --- |
| Research | `{objDir}/RESEARCH-{n}.md` | `nimbalyst-local/plans/{objective}.md` | `{objDir}/DESIGN.md` |
| Requirements | `{objDir}/REQUIREMENTS.md` | same plan doc (append) | `{objDir}/DESIGN.md` (append) |
| Plan | `{objDir}/PLAN.md` | same plan doc (checklist) | `{objDir}/PLAN.md` (gstack format) |
| Issues | `{objDir}/ISSUES.md` | embedded in plan doc | `{objDir}/ISSUES.md` |
| Tracker | — | `nimbalyst-local/tracker/tasks.md` | — |
## Shared Dispatch Patterns

These are used by all sub-skills — the canonical implementations:

```typescript
/**
 * Check a delegatable phase's provider and dispatch accordingly.
 *
 * Returns: { action, newState }
 *   action === "skip"     → phase skipped, state advanced
 *   action === "delegate" → invoke the parsed provider, state advanced
 *   action === "built-in" → caller should execute built-in logic, then call advanceState
 */
export function dispatchPhase(
  phase: DelegatablePhase,
  config: TwistedConfig,
  state: ObjectiveState,
): { action: "skip" | "delegate" | "built-in"; newState: ObjectiveState; provider?: string } {
  const { provider, fallback } = config.pipeline[phase];

  if (provider === "skip") {
    return { action: "skip", newState: advanceState(state, config.pipeline) };
  }

  if (provider !== "built-in") {
    // Delegate to external provider
    // parseProvider(provider) → { type, command?, skill? }
    // If unavailable, try fallback
    invoke(provider, fallback);
    return { action: "delegate", newState: advanceState(state, config.pipeline, provider), provider };
  }

  return { action: "built-in", newState: state };
}
```
```typescript
/**
 * Write artifacts for ALL active tracking strategies.
 * Shared loop used by scope, decompose, and execute steps.
 */
export function forEachStrategy(
  config: TwistedConfig,
  writer: (strategy: string) => void,
): void {
  for (const strategy of config.tracking) {
    writer(strategy);
  }
}
```
## Worktree Paths

```typescript
/**
 * Generate worktree paths for a given tier configuration.
 */
export function getWorktreePaths(
  worktreeDir: string,
  objective: string,
  tiers: WorktreeTiers,
): WorktreePaths {
  const base = `${worktreeDir}/${objective}`;

  switch (tiers) {
    case 1:
      return {
        objective: base,
        group: null,
        agent: null,
      };

    case 2:
      return {
        objective: base,
        group: null,
        agent: (_g, n) => `${base}-agent-${n}`,
      };

    case 3:
      return {
        objective: base,
        group: (g) => `${base}-group-${g}`,
        agent: (g, n) => `${base}-group-${g}-agent-${n}`,
      };
  }
}
```
## Pipeline Routing

```typescript
/**
 * Parse a provider string into its components.
 *
 * "built-in" → { type: "built-in" }
 * "skip" → { type: "skip" }
 * "ask" → { type: "ask" }
 * "gstack:/review" → { type: "gstack", command: "/review" }
 * "superpowers:test-driven-development" → { type: "superpowers", skill: "test-driven-development" }
 * "nimbalyst:deep-researcher" → { type: "nimbalyst", skill: "deep-researcher" }
 */
export function parseProvider(provider: ProviderString): {
  type: string;
  command?: string;
  skill?: string;
} {
  if (provider === "built-in" || provider === "skip" || provider === "ask") {
    return { type: provider };
  }

  const colonIdx = provider.indexOf(":");
  if (colonIdx === -1) return { type: provider };

  const type = provider.slice(0, colonIdx);
  const rest = provider.slice(colonIdx + 1);

  if (type === "gstack") return { type, command: rest };
  return { type, skill: rest };
}
```
```typescript
/**
 * Determine if the pipeline should pause before advancing to the next step.
 * Returns the pause reason, or null if no pause is needed.
 */
export function shouldPause(
  fromStep: ObjectiveStep,
  toStep: ObjectiveStep,
  flow: FlowConfig,
  phases: PhasesConfig,
  yolo: boolean,
): PauseReason | null {
  if (yolo) return null;

  if (!flow.auto_advance) return "user_requested";

  if (flow.pause_on_config_change && hasConfigChange(fromStep, toStep, phases)) {
    return "config_change";
  }

  // pause_on_low_context is checked at runtime (context window utilization)
  // — can't evaluate statically, so we return null here and let the
  // runtime check handle it.

  return null;
}
```

