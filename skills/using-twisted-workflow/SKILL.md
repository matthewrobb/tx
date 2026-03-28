---
name: using-twisted-workflow
description: Use when any twisted-workflow skill is active — provides shared config defaults, presets, string templates, and constraints that all phases reference
---

# twisted-workflow shared config

This skill is loaded automatically by `/twisted-work` and passed to internal sub-skills. It contains the authoritative defaults, presets, templates, rules, and constraints they reference by section name.

## Directory Structure

All twisted workflow files live under `.twisted/` in a kanban-style lane structure:

With folders enabled (default):
```
.twisted/
├── settings.json
├── todo/
│   └── {objective}/
│       ├── state.md
│       ├── RESEARCH-*.md
│       └── REQUIREMENTS.md
├── in-progress/
│   └── {objective}/
│       ├── state.md
│       ├── RESEARCH-*.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── done/
│   └── {objective}-{date}/
│       └── (all files)
└── worktrees/             ← gitignored
```

With folders disabled (`state.use_folders: false`):
```
.twisted/
├── settings.json
└── {objective}/
    ├── state.md          ← status field determines kanban position
    ├── RESEARCH-*.md
    ├── REQUIREMENTS.md
    ├── ISSUES.md
    └── PLAN.md
```

## Built-in Defaults

Complete `TwistedConfig` — all fields present. Every skill merges `.twisted/settings.json` with these defaults. Config values override defaults. Missing keys fall back silently.

```json
{
  "version": "2.0",
  "presets": [],

  "tools": {
    "detected": {
      "gstack": false,
      "superpowers": false,
      "nimbalyst_skills": false
    },
    "last_scan": null
  },

  "pipeline": {
    "research": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    },
    "arch_review": {
      "provider": "skip",
      "fallback": "skip",
      "options": {}
    },
    "code_review": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    },
    "qa": {
      "provider": "skip",
      "fallback": "skip",
      "options": {}
    },
    "ship": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    }
  },

  "execution": {
    "strategy": "task-tool",
    "discipline": null,
    "worktree_tiers": 2,
    "group_parallel": true,
    "merge_strategy": "normal",
    "review_frequency": "after-all",
    "test_requirement": "must-pass"
  },

  "phases": {
    "scope": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "execute"
    },
    "decompose": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "plan"
    },
    "execute": {
      "model": "sonnet",
      "effort": "medium",
      "context": "1m",
      "mode": "execute"
    }
  },

  "decompose": {
    "estimation": "fibonacci",
    "batch_threshold": 2,
    "split_threshold": 8,
    "categories": ["scope", "behavior", "constraints", "acceptance"]
  },

  "templates": {
    "issue": {
      "fields": [
        { "name": "id", "format": "ISSUE-{id}" },
        { "name": "title", "type": "string" },
        { "name": "type", "type": "enum", "values": ["bug", "refactor", "feature", "test"] },
        { "name": "area", "type": "string" },
        { "name": "file", "type": "string" },
        { "name": "current_state", "type": "string" },
        { "name": "target_state", "type": "string" },
        { "name": "dependencies", "type": "list" },
        { "name": "group", "type": "number" },
        { "name": "complexity", "type": "number" },
        { "name": "done", "type": "checkbox" }
      ]
    },
  },

  "state": {
    "use_folders": true,
    "folder_kanban": {
      "todo": ".twisted/todo",
      "in_progress": ".twisted/in-progress",
      "done": ".twisted/done"
    }
  },

  "flow": {
    "auto_advance": true,
    "pause_on_config_change": true,
    "pause_on_low_context": true
  },

  "writing": {
    "skill": "writing-clearly-and-concisely",
    "fallback": true
  },

  "nimbalyst": {
    "enabled": false,
    "default_priority": "medium",
    "default_owner": "claude"
  },

  "directories": {
    "root": ".twisted",
    "worktrees": ".twisted/worktrees"
  },

  "files": {
    "settings": ".twisted/settings.json",
    "changelog": "CHANGELOG.md",
    "changelog_sort": "newest-first"
  },

  "naming": {
    "strategy": "prefix",
    "increment_padding": 3
  },

  "strings": {
    "commit_messages": {
      "init": "chore: add twisted workflow",
      "plan": "chore: add {objective} research and plan",
      "done": "chore: complete {objective}",
      "lane_move": "chore: move {objective} from {from} to {to}",
      "group_merge": "feat({objective}): complete group {group}"
    },
    "status_line": "{objective}  {status}  {step}  {progress}  {updated}",
    "status_detail": "Objective: {objective}\nStatus: {status}\nStep: {step}\nProgress: {steps_completed}/{steps_remaining} steps, {issues_done}/{issues_total} issues\nGroup: {group_current}/{groups_total}\nCreated: {created}\nUpdated: {updated}",
    "phase_recommendation": "Next step: {step}\n  Model: {model}\n  Effort: {effort}\n  Context: {context}\n  Mode: {mode}",
    "research_section": "## Agent {n} — {focus}",
    "handoff_messages": {
      "research_to_scope": "Research complete ({research_count} agents). Starting scope.",
      "scope_to_decompose": "Requirements captured across {category_count} categories. Starting decomposition.",
      "decompose_to_execute": "{issue_count} issues in {group_count} groups ({agent_count} agents). Ready to execute.",
      "execute_to_review": "Execution complete ({issues_done}/{issues_total} issues). Starting review.",
      "review_to_ship": "Review passed. Ready to ship.",
      "ship_done": "Objective {objective} complete."
    },
    "research_agent_prompt": "Research the codebase for objective \"{objective}\".\nFocus area: {focus}\nCodebase context: {codebase_context}\n\nReturn structured findings: key files, patterns, concerns.",
    "execution_agent_prompt": "Implement the following issues for objective \"{objective}\":\n\nIssue IDs: {issue_ids}\n{issue_details}\n\nWork in worktree: {worktree_path}\nBranch: {branch_name}\nTest requirement: {test_requirement}\n{discipline}\n\nCommit your implementation. Mark issues as done. Report results.",
    "interrogation_prompt": "Let's drill into {category}. Tell me everything about this area — be specific and concrete. I will push back on anything vague.",
    "changelog_entry": [
      "## {date} — {objective}",
      "### Completed",
      "{completed}",
      "### Deferred",
      "{deferred}",
      "### Decisions",
      "{decisions}"
    ]
  },

  "context_skills": []
}
```

## Default String Templates

All user-facing text uses these templates. Placeholders use `{name}` syntax. Skills reference `strings.*` from the resolved config — never hardcode text that has a template.

### Commit Messages (`strings.commit_messages`)

| Key | Default | Placeholders |
|---|---|---|
| `init` | `chore: add twisted workflow` | — |
| `plan` | `chore: add {objective} research and plan` | `{objective}` |
| `done` | `chore: complete {objective}` | `{objective}` |
| `lane_move` | `chore: move {objective} from {from} to {to}` | `{objective}`, `{from}`, `{to}` |
| `group_merge` | `feat({objective}): complete group {group}` | `{objective}`, `{group}` |

### Status Display (`strings.status_line`, `strings.status_detail`)

**Status line** (one per objective in list view):
```
{objective}  {status}  {step}  {progress}  {updated}
```

**Status detail** (single objective detail view):
```
Objective:  {objective}
Status:     {status}
Step:       {step}
Progress:   {steps_completed}/{steps_remaining} steps, {issues_done}/{issues_total} issues
Group:      {group_current}/{groups_total}
Created:    {created}
Updated:    {updated}
```

### Phase Recommendation (`strings.phase_recommendation`)

```
Next step: {step}
  Model:   {model}
  Effort:  {effort}
  Context: {context}
  Mode:    {mode}
```

### Research Section (`strings.research_section`)

```
## Agent {n} — {focus}
```

### Handoff Messages (`strings.handoff_messages`)

| Key | Default | Placeholders |
|---|---|---|
| `research_to_scope` | `Research complete ({research_count} agents). Starting scope.` | `{research_count}` |
| `scope_to_decompose` | `Requirements captured across {category_count} categories. Starting decomposition.` | `{category_count}` |
| `decompose_to_execute` | `{issue_count} issues in {group_count} groups ({agent_count} agents). Ready to execute.` | `{issue_count}`, `{group_count}`, `{agent_count}` |
| `execute_to_review` | `Execution complete ({issues_done}/{issues_total} issues). Starting review.` | `{issues_done}`, `{issues_total}` |
| `review_to_ship` | `Review passed. Ready to ship.` | — |
| `ship_done` | `Objective {objective} complete.` | `{objective}` |

### Agent Prompts (`strings.research_agent_prompt`, `strings.execution_agent_prompt`)

**Research agent prompt:**
```
Research the codebase for objective "{objective}".
Focus area: {focus}
Codebase context: {codebase_context}

Return structured findings: key files, patterns, concerns.
```

**Execution agent prompt:**
```
Implement the following issues for objective "{objective}":

Issue IDs: {issue_ids}
{issue_details}

Work in worktree: {worktree_path}
Branch: {branch_name}
Test requirement: {test_requirement}
{discipline}

Commit your implementation. Mark issues as done. Report results.
```

### Interrogation Prompt (`strings.interrogation_prompt`)

```
Let's drill into {category}. Tell me everything about this area — be specific and concrete. I will push back on anything vague.
```

### Changelog Entry (`strings.changelog_entry`)

```
## {date} — {objective}
### Completed
{completed}
### Deferred
{deferred}
### Decisions
{decisions}
```

## Built-in Presets

Presets are sparse overrides on **Built-in Defaults**. Only the fields that differ are specified. Preset JSON files live in `presets/` at the plugin root.

`presets` is an array. The first preset has the highest priority — earlier presets override later ones on conflict. Put the most important one first.

```
Layer 1: Built-in defaults          ← complete, valid config
Layer 2: Presets (first wins)        ← cascaded right-to-left, so the first/leftmost preset wins
Layer 3: Per-project (optional)      ← sparse delta on top of everything

Result: deepMerge(defaults, ...presets.reverse().map(load), projectSettings ?? {})
```

| Preset | File | What it overrides |
|---|---|---|
| `standalone` | `presets/standalone.json` | Nothing — pure defaults |
| `superpowers` | `presets/superpowers.json` | TDD discipline, code review → Superpowers |
| `gstack` | `presets/gstack.json` | research, arch_review, code_review, qa, ship → gstack |
| `nimbalyst` | `presets/nimbalyst.json` | research, code review → Nimbalyst |
| `minimal` | `presets/minimal.json` | All delegatable phases → skip, tests deferred |

### Composing Presets

The first preset has priority. Put the most important one first:

| `presets` value | Effect |
|---|---|
| `[]` | Pure defaults (same as `["standalone"]`) |
| `["superpowers"]` | TDD + Superpowers code review |
| `["gstack"]` | All delegatable phases → gstack |
| `["superpowers", "gstack"]` | Superpowers wins for code review (it's first), gstack fills in the rest |
| `["gstack", "superpowers"]` | gstack wins for code review (it's first), TDD discipline still applies |
| `["nimbalyst", "superpowers", "gstack"]` | Nimbalyst wins for research + code review, then Superpowers, then gstack for the rest |

Load each preset file and apply right-to-left so the first preset ends up on top. Each file contains a `PresetOverrides` object — a sparse partial of `TwistedConfig` (omitting `presets` and `version`).

## Three-Layer Config Resolution

1. Start with **Built-in Defaults** (complete `TwistedConfig` — every field present).
2. If `presets` is set in `settings.json`, load each preset file and apply right-to-left so the first/leftmost preset has highest priority.
3. Deep-merge all remaining fields from `settings.json` onto the result.
4. The final result is a complete `TwistedConfig` with no missing fields.

Rules:
- `settings.json` stores only customized keys — never a full snapshot.
- Future default changes apply automatically without manual config updates.
- Never error on missing keys — fall back to defaults silently.
- Deep merge: nested objects merge recursively, scalars and arrays replace.
- Unknown preset names are silently skipped (future-proofing for custom presets).

## State Machine

Frontmatter in `state.md` is the source of truth for every objective. All state transitions are atomic frontmatter updates, then folder moves (when enabled).

### ObjectiveState Frontmatter

```yaml
---
objective: auth-refactor
status: in-progress
step: execute
steps_completed:
  - research
  - scope
  - decompose
steps_remaining:
  - code_review
  - qa
  - ship
group_current: 2
groups_total: 4
issues_done: 4
issues_total: 7
created: "2026-03-26"
updated: "2026-03-26T14:30:00Z"
tools_used:
  research: built-in
  scope: built-in
  decompose: built-in
---
```

### Pipeline Step Sequence

Full ordered sequence of all steps:

```
research → scope → arch_review → decompose → execute → code_review → qa → ship
```

Delegatable steps configured as `"skip"` are omitted at runtime. Core steps (scope, decompose, execute) are always present.

### Step Transitions

When a step completes:
1. Move current step to `steps_completed`.
2. Determine next step from the pipeline sequence, skipping any delegatable steps with `provider: "skip"`.
3. Set `step` to the next step.
4. Update `steps_remaining` to exclude the new current step.
5. Update `updated` timestamp.
6. If `status` needs to change (e.g., starting execute → `in-progress`), update `status` and move folder.

### Status Transitions

| From | To | Trigger |
|---|---|---|
| — | `todo` | Objective created |
| `todo` | `in-progress` | Execute step starts |
| `in-progress` | `done` | Ship step completes |
| any | `blocked` | Manual or error |

## Auto-Advance Logic

The pipeline pauses between steps based on `flow` config:

1. **Always** (`flow.auto_advance: false`): Pause after every step, regardless of other settings. The user confirms before each step begins.
2. **Config change** (`flow.pause_on_config_change: true`): Pause when the next step has different `model`, `effort`, `context`, or `mode` settings than the current step. Show the `strings.phase_recommendation` template and wait for confirmation.
3. **Low context** (`flow.pause_on_low_context: true`): Pause when context window utilization is high. Suggest starting a new session.

When `flow.auto_advance` is `true` (default): the pipeline advances automatically, pausing only when condition 2 or 3 triggers.

When `--yolo` is active: skip all pauses (including "always"), use merged config values directly, auto-advance through every step.

## Provider Delegation

Delegatable phases (research, arch_review, code_review, qa, ship) route to their configured provider:

| Provider format | Action |
|---|---|
| `"built-in"` | Use twisted-workflow's own implementation |
| `"gstack:/{command}"` | Invoke the gstack slash command |
| `"superpowers:{skill}"` | Invoke the Superpowers skill |
| `"nimbalyst:{skill}"` | Invoke the Nimbalyst skill |
| `"skip"` | Omit this phase entirely |
| `"ask"` | Ask the user which provider to use |

When the primary provider is unavailable, fall back to the `fallback` provider. If both are unavailable, report the error and pause.

## Objective Naming

- At the start of scope (when no objective exists), ask: "What is the short name for this objective? Leave blank for auto-suggestions."
- If name provided: create the objective directory immediately.
- If blank:
  - Spawn a single fast scout agent for a minimal codebase scan.
  - Suggest 3 names using **Writing Quality** rules.
  - Wait for confirmation.
  - Create directory once confirmed.
- If no name given and none selected: fall back to zero-padded numeric increment based on total folders across all lanes.
- Done folder appends date: `{objective}-{date}`.
- All subsequent steps inherit the objective name — never ask again.

## Writing Quality

- Before generating any human-facing text, check if the skill named in `writing.skill` is available.
- Human-facing text includes: commit messages, changelog entries, status displays, handoff messages, summaries, objective name suggestions, phase recommendations.
- If writing skill available: invoke it for all human-facing text generation.
- If not available and `writing.fallback` is `true`:
  - Prefer active voice.
  - One idea per sentence.
  - No filler words or hedging.
  - Commit messages: imperative mood, under 72 chars, specific.
  - Summaries: what changed, not what was attempted.
  - Status: facts only, no commentary.
  - Handoff messages: action + outcome, nothing more.
- If not available and `writing.fallback` is `false`: proceed without special writing guidance.

## Gitignore Rules

- `/twisted-work init` checks if the project is a git repo.
- If yes, checks `.gitignore` for `.twisted/worktrees/`.
- If not present, adds:
  ```
  # twisted workflow worktrees
  .twisted/worktrees/
  ```
- Committed: `.twisted/settings.json`, lane directories, objective files.
- Gitignored: `.twisted/worktrees/`.

## Kanban Transitions

With `state.use_folders: true`:

- Objective folder created in the `todo` lane directory during scope.
- Folder stays in `todo` through scope, arch_review, and decompose steps.
- Folder moves `todo` → `in-progress` when the execute step starts. Commit this move.
- Folder moves `in-progress` → `done/{objective}-{date}` when ship completes. Commit this move.
- Files inside the folder never change name — only the parent folder moves between lanes.
- Never move a folder backward through lanes.
- Always commit after a lane move using `strings.commit_messages.lane_move`.

With `state.use_folders: false`:

- All objectives live in flat `.twisted/{objective}/` directories.
- The `status` field in `state.md` frontmatter determines the kanban position.
- No folder moves — only frontmatter updates.

## Changelog

- Path comes from `files.changelog` in merged config.
- All reads, writes, and commits use the configured path.
- Never hardcode — always use the config value.
- On ship completion:
  - If file exists at configured path: prepend new entry (newest first) or append (oldest first) based on `files.changelog_sort`.
  - If not: create at configured path.
  - Use `strings.changelog_entry` template.
  - Commit as part of the ship commit.

## Mode Guide

| Mode | Use when |
|---|---|
| `execute` | Work is autonomous or conversational |
| `plan` | Human should review before files change |

- Never use plan mode for research or interrogation steps.
- Always use plan mode for decompose (human reviews issue breakdown before files change).

## Yolo Mode

- Any `/twisted-work` subcommand accepts a `--yolo` flag as a runtime parameter.
- `--yolo` is not persisted in `settings.json` — it is a per-invocation flag.
- When `--yolo` is active:
  - Skip settings confirmation — use merged config values directly.
  - Skip handoff pauses — auto-advance to next step immediately.
  - Skip "continue or stop?" prompts between execution groups.
  - Scope interrogation still asks its questions — the phase is inherently interactive.
- When `--yolo` is not active: all confirmations and pauses work as described in **Auto-Advance Logic**.
- When `/twisted-work` invokes a sub-skill with `--yolo`, pass the flag through.

## Tool Detection

During `/twisted-work init` or `/twisted-work config tools`:

1. Scan for gstack: look for gstack skills in the project or global skill directories.
2. Scan for Superpowers: look for Superpowers skills (e.g., `test-driven-development`, `requesting-code-review`).
3. Scan for Nimbalyst skills: look for Nimbalyst skill directories.
4. Record results in `tools.detected` and update `tools.last_scan`.
5. Suggest a preset array based on detected tools (most important first):
   - gstack + Superpowers + Nimbalyst → `["nimbalyst", "superpowers", "gstack"]`
   - gstack + Superpowers → `["superpowers", "gstack"]`
   - gstack only → `["gstack"]`
   - Superpowers only → `["superpowers"]`
   - Nothing detected → `[]`

## Worktree Hierarchy

Worktree layout depends on `execution.worktree_tiers`:

**1 tier** (objective only):
```
.twisted/worktrees/{objective}/          ← branched from main
```
Agents work directly on the objective branch. No isolation between agents.

**2 tiers** (default — objective → agent):
```
.twisted/worktrees/{objective}/          ← branched from main
.twisted/worktrees/{objective}-agent-N/  ← branched from objective
```
Each agent gets its own worktree. Agents merge into the objective branch.

**3 tiers** (objective → group → agent):
```
.twisted/worktrees/{objective}/                        ← branched from main
.twisted/worktrees/{objective}-group-N/                ← branched from objective
.twisted/worktrees/{objective}-group-N-agent-M/        ← branched from group
```
Agents merge into group, groups merge into objective. Structured history.

## Nimbalyst Integration (Experimental)

When `nimbalyst.enabled` is `true` (auto-enabled by the nimbalyst preset), twisted-workflow writes Nimbalyst-compatible files in `nimbalyst-local/` so Nimbalyst's Task Mode can discover them.

Based on the Nimbalyst skills repos (`Nimbalyst/skills`, `Nimbalyst/developer-claude-code-commands`) as of March 2026.

### Plan File

Write a plan file to `nimbalyst-local/plans/{objective}.md` with Nimbalyst plan frontmatter:

```yaml
---
planId: plan-{objective}
title: {objective title}
status: in-development
planType: feature
priority: medium
owner: claude
stakeholders: []
tags: []
created: "2026-03-27"
updated: "2026-03-27T14:30:00Z"
progress: 57
startDate: "2026-03-27"
---
```

**Never** use midnight timestamps (00:00:00.000Z) for the `updated` field.

#### Plan Content

After frontmatter, include:
1. Title
2. Goals (from objective description)
3. Key components or phases (from PLAN.md groups)
4. Acceptance criteria (from REQUIREMENTS.md)
5. Implementation progress checklist (from ISSUES.md)

```markdown
## Implementation Progress

- [x] ISSUE-001: Extract token validation
- [x] ISSUE-002: Add session store
- [ ] ISSUE-003: Fix race condition in refresh
- [ ] ISSUE-004: Update API routes
```

The `progress` field is computed as: `(checked items / total items) * 100`, rounded to nearest integer.

#### Plan Status Mapping

| twisted-workflow state | Nimbalyst plan status |
|---|---|
| `todo` (step: research, scope) | `draft` |
| `todo` (step: decompose) | `ready-for-development` |
| `in-progress` (step: execute) | `in-development` |
| `in-progress` (step: code_review, qa) | `in-review` |
| `done` | `completed` |
| `blocked` | `blocked` |

#### Plan Type Mapping

| objective content | Nimbalyst planType |
|---|---|
| Bug fixes | `bug-fix` |
| Code restructuring | `refactor` |
| Architecture work | `system-design` |
| Research objectives | `research` |
| Everything else | `feature` |

### Tracker Items

Append tracker items to `nimbalyst-local/tracker/tasks.md` (or `bugs.md` for bug-type issues) using Nimbalyst's inline tag format:

```markdown
- [ISSUE-001] Extract token validation #task[id:task_01JQXYZ status:done priority:medium created:2026-03-27]
- [ISSUE-002] Add session store #task[id:task_01JQXYA status:done priority:medium created:2026-03-27]
- [ISSUE-003] Fix race condition #bug[id:bug_01JQXYB status:in-progress priority:high created:2026-03-27]
- [ISSUE-004] Update API routes #task[id:task_01JQXYC status:to-do priority:medium created:2026-03-27]
```

Format: `- [description] #[type][id:[type]_[ulid] status:[status] priority:[priority] created:YYYY-MM-DD]`

Generate a ULID for each item's `id` field. Tracker status values: `to-do`, `in-progress`, `done`, `blocked`.

Use `#bug` for issues with `type: "bug"`, `#task` for all other types.

### When to Update

Update Nimbalyst files whenever `state.md` is updated:
- Step transitions → update plan status
- Issue completion → check off in plan, update tracker status, recalculate progress
- Group completion → recalculate progress
- Objective completion → plan status `completed`, all tracker items `done`

Create the `nimbalyst-local/plans/` and `nimbalyst-local/tracker/` directories if they don't exist.

### Priority

Use `nimbalyst.default_priority` from config for new objectives. Read the existing plan file's priority before updating — preserve user overrides.

## Shared Constraints

- Works with any codebase regardless of stack.
- All twisted files live under `.twisted/` — changelog at configured path.
- Frontmatter in `state.md` is the source of truth for objective state.
- State transitions are atomic frontmatter updates, then folder moves (when enabled).
- Config merges with built-in defaults on every invocation — missing keys fall back silently.
- All human-facing text uses **Writing Quality** rules.
- Changelog always at configured path, never hardcoded.
- String templates from resolved config define all user-facing text — never hardcode text that has a template.
- Every configurable value must match the corresponding type in `types/`.
