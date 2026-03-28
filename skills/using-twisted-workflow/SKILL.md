---
name: using-twisted-workflow
description: "Shared reference — config defaults, presets, and tracking strategy artifact map"
---

# twisted-workflow shared reference

Config defaults, preset definitions, and tracking strategy artifact mapping. Sub-skills reference source files in `src/` directly for shared logic.

---

## Built-in Defaults

```ts
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

## Presets

| Preset        | What it overrides                                           |
| ------------- | ----------------------------------------------------------- |
| `twisted`     | tracking → twisted artifact format                          |
| `superpowers` | TDD discipline, code review → Superpowers                   |
| `gstack`      | tracking → gstack, all delegatable phases → gstack commands |
| `nimbalyst`   | tracking → nimbalyst, research + code review → Nimbalyst    |
| `minimal`     | all delegatable phases → skip, tests deferred               |

First preset wins on conflict. Compose in any order:

- `["superpowers", "gstack"]` → Superpowers wins for code review, gstack fills the rest
- `["gstack", "superpowers"]` → gstack wins for code review, TDD still active

---

## Tracking Strategy Artifact Map

| Step         | twisted                    | nimbalyst                              | gstack                             |
| ------------ | -------------------------- | -------------------------------------- | ---------------------------------- |
| Research     | `{objDir}/RESEARCH-{n}.md` | `nimbalyst-local/plans/{objective}.md` | `{objDir}/DESIGN.md`               |
| Requirements | `{objDir}/REQUIREMENTS.md` | same plan doc (append)                 | `{objDir}/DESIGN.md` (append)      |
| Plan         | `{objDir}/PLAN.md`         | same plan doc (checklist)              | `{objDir}/PLAN.md` (gstack format) |
| Issues       | `{objDir}/ISSUES.md`       | embedded in plan doc                   | `{objDir}/ISSUES.md`               |
| Tracker      | —                          | `nimbalyst-local/tracker/tasks.md`     | —                                  |

