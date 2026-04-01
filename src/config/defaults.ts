/**
 * Complete built-in defaults — every TwistedConfig field present.
 * This is Layer 1 of the 3-layer config resolution.
 */

import type { TwistedConfig } from "../../types/config.js";

export const defaults: TwistedConfig = {
  version: "3.0",
  presets: [],

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
    plan: { model: "opus", effort: "max", context: "default", mode: "plan" },
    build: { model: "sonnet", effort: "medium", context: "1m", mode: "execute" },
  },

  plan: {
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
      "Progress:  {steps_done}/{steps_total} steps, {tasks_done}/{tasks_total} tasks",
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
      scope_to_plan: "Requirements captured across {category_count} categories. Starting plan.",
      plan_to_build: "{issue_count} issues in {group_count} groups ({agent_count} agents). Ready to build.",
      build_to_review: "Build complete ({issues_done}/{issues_total} issues). Starting review.",
      review_to_close: "Review passed. Ready to close.",
      close_done: "Objective {objective} complete.",
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

// --- v4 defaults ---

import type { TwistedConfigV4 } from "../../types/config.js";

/**
 * v4 defaults — artifact-driven engine with 6-lane filesystem.
 * Lanes: 0-backlog | 1-ready | 2-active | 3-review | 4-done | 5-archive
 */
export const defaultsV4: TwistedConfigV4 = {
  version: "4.0",
  presets: [],

  lanes: [
    {
      name: "backlog",
      dir: "0-backlog",
      steps: [],
    },
    {
      name: "ready",
      dir: "1-ready",
      steps: [
        {
          name: "estimate",
          produces: [{ path: "estimate.json" }],
          exit_when: [{ name: "artifact.exists", args: { path: "estimate.json" } }],
        },
      ],
    },
    {
      name: "active",
      dir: "2-active",
      steps: [
        {
          name: "research",
          produces: [{ path: "research/research.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "research/research.md" } }],
        },
        {
          name: "scope",
          requires: [{ path: "research/research.md" }],
          produces: [{ path: "scope.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "scope.md" } }],
        },
        {
          name: "plan",
          requires: [{ path: "scope.md" }],
          produces: [{ path: "plan.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "plan.md" } }],
        },
        {
          name: "build",
          requires: [{ path: "plan.md" }],
          exit_when: [{ name: "tasks.all_done" }],
        },
      ],
      entry_requires: [{ name: "lane.exists", args: { dir: "1-ready" } }],
    },
    {
      name: "review",
      dir: "3-review",
      steps: [
        {
          name: "review",
          produces: [{ path: "review.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "review.md" } }],
        },
      ],
    },
    {
      name: "done",
      dir: "4-done",
      steps: [],
    },
    {
      name: "archive",
      dir: "5-archive",
      steps: [],
    },
  ],

  types: [
    { type: "feature", lanes: ["0-backlog", "1-ready", "2-active", "4-done"] },
    { type: "bug", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "spike", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "chore", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "release", lanes: ["0-backlog", "1-ready", "2-active", "3-review", "4-done"] },
  ],

  context_skills: [],
};
