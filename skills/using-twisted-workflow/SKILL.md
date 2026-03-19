---
name: using-twisted-workflow
description: Use when any twisted-workflow skill is active — provides shared config defaults, templates, constraints, and rules that all phases reference
---

# twisted-workflow shared config

This skill is loaded automatically by all twisted-workflow phase skills. It contains the authoritative defaults, templates, rules, and constraints they reference by section name.

## Directory Structure

All twisted workflow files live under .twisted/ in a kanban-style lane structure:

```
.twisted/
├── settings.json
├── todo/
│   └── {objective}/
│       ├── RESEARCH-1.md
│       ├── RESEARCH-2.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── in-progress/
│   └── {objective}/
│       └── (same files)
├── done/
│   └── {objective}-[date]/
│       └── (same files)
└── worktrees/             ← gitignored
```

## Built-in Defaults

Every skill merges these with .twisted/settings.json. Config values override defaults. Missing keys fall back silently. Never error on missing keys.

```json
{
  "version": "1.0",

  "context_skills": [],

  "writing": {
    "skill": "writing-clearly-and-concisely",
    "fallback": true
  },

  "phases": {
    "new": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "execute"
    },
    "define": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "execute"
    },
    "plan": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "plan"
    },
    "build": {
      "model": "sonnet",
      "effort": "medium",
      "context": "1m",
      "mode": "execute"
    },
    "review": {
      "model": "sonnet",
      "effort": "medium",
      "context": "default",
      "mode": "plan"
    },
    "accept": {
      "model": "sonnet",
      "effort": "low",
      "context": "default",
      "mode": "execute"
    }
  },

  "directories": {
    "root": ".twisted",
    "todo": ".twisted/todo",
    "in_progress": ".twisted/in-progress",
    "done": ".twisted/done",
    "worktrees": ".twisted/worktrees"
  },

  "files": {
    "settings": ".twisted/settings.json",
    "issues": "ISSUES.md",
    "plan": "PLAN.md",
    "requirements": "REQUIREMENTS.md",
    "changelog": "CHANGELOG.md",
    "changelog_sort": "newest-first"
  },

  "naming": {
    "strategy": "prefix",
    "increment_padding": 3
  },

  "templates": {
    "issue": [
      "## [ISSUE-{id}] {title}",
      "- **Type**: bug/refactor/feature/test",
      "- **Area**: {area}",
      "- **File**: {file}",
      "- **Current state**: {current}",
      "- **Target state**: {target}",
      "- **Depends on**: {dependencies}",
      "- **Group**: {group}",
      "- [ ] Done"
    ],
    "research_section": [
      "## Agent {n} — {focus}",
      "**Status**: Done",
      "**Findings**:",
      "{findings}"
    ],
    "changelog_entry": [
      "## {date} — {objective}",
      "### Completed",
      "{completed}",
      "### Deferred",
      "{deferred}",
      "### Key Decisions",
      "{decisions}"
    ]
  },

  "commit_messages": {
    "init": "chore: add twisted workflow",
    "plan": "chore: add {objective} research and plan",
    "done": "chore: complete {objective}"
  }
}
```

## Configuration System

- All skills read .twisted/settings.json and merge with built-in defaults above
- Config file values override defaults
- Missing keys fall back to defaults silently
- Never error on missing keys
- .twisted/settings.json is a sparse override layer — stores only keys the human explicitly customised, never a full snapshot
- Future default changes apply automatically without manual config updates
- If .twisted/settings.json does not exist, use all defaults silently and note: "No .twisted/settings.json found, using defaults. Run /twisted-work init to configure."

## Sparse Config Principle

- settings.json stores only customised keys
- /twisted-work init shows complete merged result so human can see everything including defaults
- /twisted-work init only writes customised keys back
- Every skill merges sparse config with defaults on every invocation — merge is always authoritative

## Writing Quality

- Before generating any human-facing text, check if the skill named in writing.skill is available
- Human-facing text includes: commit messages, changelog entries, status displays, handoff messages, summaries, objective name suggestions, phase recommendations
- If writing skill available: invoke it for all human-facing text generation
- If not available and writing.fallback is true:
  - Prefer active voice
  - One idea per sentence
  - No filler words or hedging
  - Commit messages: imperative mood, under 72 chars, specific not vague
  - Summaries: what changed, not what was attempted
  - Status: facts only, no commentary
  - Handoff messages: action + outcome, nothing more
- If not available and writing.fallback is false: proceed without special writing guidance
- writing.skill can be set to any installed skill name

## Gitignore Rules

- /twisted-work init checks if project is a git repo
- If yes, checks .gitignore for .twisted/worktrees/
- If not present, adds:
  ```
  # twisted workflow worktrees
  .twisted/worktrees/
  ```
- Committed directories:
  - .twisted/settings.json  — committed
  - .twisted/todo/          — committed
  - .twisted/in-progress/   — committed
  - .twisted/done/          — committed
  - .twisted/worktrees/     — gitignored

## Kanban Transitions

- Objective folder created in .twisted/todo/ during /twisted-new
- Folder stays in todo/ through define and plan phases
- Folder moves todo/ → in-progress/ when /twisted-build starts — commit this move
- Folder moves in-progress/ → done/{objective}-[date]/ on /twisted-accept — commit this move
- Files inside folder never change name — only parent folder moves between lanes
- No file prefixing — objective name is the folder
- Never move folder backward through lanes
- Always commit after a lane move

## Phase Detection

Used by /twisted-work to determine current phase:

| Files present | Lane | Current | Next |
|---|---|---|---|
| RESEARCH-*.md only | todo | new | define |
| REQUIREMENTS.md | todo | define | plan |
| ISSUES.md + PLAN.md | todo | plan complete | build |
| unchecked items in ISSUES.md | in-progress | build | review |
| all items checked | in-progress | review | accept |
| any files | done | done | none |
| no folder found | — | none | new |

## Objective Naming

- At start of /twisted-new, before any agents spawn: "What is the short name for this objective? This will be the folder name for all files. Leave blank and I will suggest names after a quick initial scan."
- If name provided: create .twisted/todo/{objective}/ immediately, all files written there from the start
- If blank:
  - Spawn single fast scout agent for minimal scan
  - Suggest 3 names using writing quality rules
  - Wait for confirmation
  - Create folder once name confirmed
- All files written to objective folder from creation — no renaming or moving within todo/
- All subsequent skills inherit objective name — never ask again
- If entering pipeline after /twisted-new, ask for name at very start of that skill and create folder before reading or writing any files
- If no name given, fall back to zero-padded numeric increment based on total folders across all lanes
- Done folder appends date: {objective}-[date]

## Changelog

- Path comes from files.changelog in merged config
- All reads, writes and commits use configured path
- Never hardcode — always use config value
- On /twisted-accept:
  - If file exists at configured path: prepend new entry, newest always at top
  - If not: create at configured path
  - Commit at configured path as part of accept commit

## Naming Convention

- Objective name is the folder name, not a file prefix
- Files use standard names inside the folder:
  - RESEARCH-1.md, RESEARCH-2.md (split by agent group)
  - REQUIREMENTS.md
  - ISSUES.md
  - PLAN.md
- No file is ever renamed — folder moves, files stay
- Done folder appends date: {objective}-[date]

## Mode Guide

| Mode | Use when |
|---|---|
| Execute | Work is autonomous or conversational |
| Plan | Human should review before files change |

- Never use Plan mode for research or questioning phases
- Always use Plan mode for planning and verification

## Yolo Mode

- Any skill or /twisted-work command accepts a `--yolo` flag as a runtime parameter
- `--yolo` is not persisted in settings.json — it is a per-invocation flag
- When `--yolo` is active:
  - Skip settings confirmation — use merged config values directly
  - Skip handoff confirmation — auto-advance to next phase immediately
  - Skip "continue or stop?" prompts between build groups — continue automatically
  - /twisted-define still asks its questions — the phase is inherently interactive
- When `--yolo` is not active: all confirmations and handoffs work as described in Handoff Rules below
- When /twisted-work invokes a sub-skill with `--yolo`, pass the flag through to the invoked skill

## Handoff Rules

- Every skill loads using-twisted-workflow for shared config
- Every skill reads and merges .twisted/settings.json with built-in defaults
- Every skill injects context_skills from merged config
- Every skill checks writing.skill availability
- Every skill recommends model, effort, mode and context window from merged config and waits for confirmation
- Human can override any value at invocation time
- Every skill asks for explicit confirmation before handing off — never auto-advance
- Human can stop at any handoff point and resume later
- All confirmation and handoff behavior is subject to **Yolo Mode** — when `--yolo` is passed, skip confirmations and auto-advance
- Objective name and folder established at start of /twisted-new before any files are written
- If entering after /twisted-new, ask for objective name and create folder before reading or writing

## Shared Constraints

- Works with any codebase regardless of stack
- All twisted files live under .twisted/ — changelog at configured path
- Superpowers skills fire automatically throughout
- Objective worktree in .twisted/worktrees/{objective}/
- Group worktrees in .twisted/worktrees/{objective}-group-N/
- Issue worktrees in .twisted/worktrees/{objective}-group-N-issue-XXX/
- Issue worktrees branch from the group branch
- Group worktrees branch from the objective branch
- Issue worktrees merge (normal) into their group branch
- Group branches squash merge into the objective branch — one commit per group on the objective
- Objective branch merges into main at /twisted-accept
- Tests must pass before subagent reports back
- Spec compliance review always before code quality review
- Never skip /requesting-code-review between groups
- Config merges with built-in defaults on every invocation — missing keys fall back silently
- All human-facing text uses writing quality rules
- Changelog always at configured path, never hardcoded
