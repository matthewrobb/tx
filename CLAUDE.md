# twisted-workflow

A kanban-style agentic development workflow for Claude Code
with parallel execution, session-independent state, and
configurable phases.

## Plugin Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   ├── twisted-work/SKILL.md
│   ├── twisted-explore/SKILL.md
│   ├── twisted-define/SKILL.md
│   ├── twisted-plan/SKILL.md
│   ├── twisted-build/SKILL.md
│   ├── twisted-review/SKILL.md
│   └── twisted-accept/SKILL.md
├── README.md
└── CHANGELOG.md
```

## Directory Structure

All twisted workflow files live under .twisted/ in a
kanban-style lane structure:

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

Every skill merges these with .twisted/settings.json.
Config values override defaults. Missing keys fall back
silently. Never error on missing keys.

```json
{
  "version": "1.0",

  "context_skills": [],

  "writing": {
    "skill": "writing-clearly-and-concisely",
    "fallback": true
  },

  "phases": {
    "explore": {
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

- All skills read .twisted/settings.json and merge with
  built-in defaults above
- Config file values override defaults
- Missing keys fall back to defaults silently
- Never error on missing keys
- .twisted/settings.json is a sparse override layer —
  stores only keys the human explicitly customised,
  never a full snapshot
- Future default changes apply automatically without
  manual config updates
- If .twisted/settings.json does not exist, use all
  defaults silently and note:
  "No .twisted/settings.json found, using defaults.
  Run /twisted-work init to configure."

## Sparse Config Principle

- settings.json stores only customised keys
- /twisted-work init shows complete merged result
  so human can see everything including defaults
- /twisted-work init only writes customised keys back
- Every skill merges sparse config with defaults on
  every invocation — merge is always authoritative

## Writing Quality

- Before generating any human-facing text, check if
  the skill named in writing.skill is available
- Human-facing text includes: commit messages, changelog
  entries, status displays, handoff messages, summaries,
  objective name suggestions, phase recommendations
- If writing skill available: invoke it for all
  human-facing text generation
- If not available and writing.fallback is true:
  - Prefer active voice
  - One idea per sentence
  - No filler words or hedging
  - Commit messages: imperative mood, under 72 chars,
    specific not vague
  - Summaries: what changed, not what was attempted
  - Status: facts only, no commentary
  - Handoff messages: action + outcome, nothing more
- If not available and writing.fallback is false:
  proceed without special writing guidance
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

- Objective folder created in .twisted/todo/ during
  /twisted-explore
- Folder stays in todo/ through define and plan phases
- Folder moves todo/ → in-progress/ when /twisted-build
  starts — commit this move
- Folder moves in-progress/ → done/{objective}-[date]/
  on /twisted-accept — commit this move
- Files inside folder never change name — only parent
  folder moves between lanes
- No file prefixing — objective name is the folder
- Never move folder backward through lanes
- Always commit after a lane move

## Phase Detection

Used by /twisted-work to determine current phase:

| Files present | Lane | Current | Next |
|---|---|---|---|
| RESEARCH-*.md only | todo | explore | define |
| REQUIREMENTS.md | todo | define | plan |
| ISSUES.md + PLAN.md | todo | plan complete | build |
| unchecked items in ISSUES.md | in-progress | build | review |
| all items checked | in-progress | review | accept |
| any files | done | done | none |
| no folder found | — | none | explore |

## Objective Naming

- At start of /twisted-explore, before any agents spawn:
  "What is the short name for this objective?
  This will be the folder name for all files.
  Leave blank and I will suggest names after a
  quick initial scan."
- If name provided: create .twisted/todo/{objective}/
  immediately, all files written there from the start
- If blank:
  - Spawn single fast scout agent for minimal scan
  - Suggest 3 names using writing quality rules
  - Wait for confirmation
  - Create folder once name confirmed
- All files written to objective folder from creation —
  no renaming or moving within todo/
- All subsequent skills inherit objective name —
  never ask again
- If entering pipeline after /twisted-explore, ask for
  name at very start of that skill and create folder
  before reading or writing any files
- If no name given, fall back to zero-padded numeric
  increment based on total folders across all lanes
- Done folder appends date: {objective}-[date]

## Changelog

- Path comes from files.changelog in merged config
- All reads, writes and commits use configured path
- Never hardcode — always use config value
- On /twisted-accept:
  - If file exists at configured path: prepend new entry,
    newest always at top
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

## Handoff Rules

- Every skill reads CLAUDE.md first
- Every skill reads and merges .twisted/settings.json
  with built-in defaults from CLAUDE.md
- Every skill injects context_skills from merged config
- Every skill checks writing.skill availability
- Every skill recommends model, effort, mode and context
  window from merged config and waits for confirmation
- Human can override any value at invocation time
- Every skill asks for explicit confirmation before
  handing off — never auto-advance
- Human can stop at any handoff point and resume later
- Objective name and folder established at start of
  /twisted-explore before any files are written
- If entering after /twisted-explore, ask for objective
  name and create folder before reading or writing

## Shared Constraints

- Works with any codebase regardless of stack
- All twisted files live under .twisted/ — changelog
  at configured path
- Superpowers skills fire automatically throughout
- Worktrees in .twisted/worktrees/{objective}-issue-XXX
- Tests must pass before subagent reports back
- Spec compliance review always before code quality review
- Never skip /requesting-code-review between groups
- Config merges with built-in defaults on every
  invocation — missing keys fall back silently
- All human-facing text uses writing quality rules
- Changelog always at configured path, never hardcoded

## Skill Behavior Reference

### /twisted-work params

```
/twisted-work                    — interactive mode
/twisted-work init               — setup or update config
/twisted-work status             — show all objectives
/twisted-work next               — auto-advance active objective
/twisted-work next {objective}   — advance named objective
/twisted-work resume {objective} — resume named objective
```

### /twisted-work init steps

1. Ensure .twisted/ directory structure exists
2. Apply gitignore rules
3. If settings.json exists: load, merge, show labelled
   result (custom/default/new default), ask to update,
   write only customised keys back
4. If settings.json does not exist: ask setup questions
   one at a time, show merged result, write only
   customised keys, commit

Setup questions:
- "What context skills should be injected every session?
  (e.g. /lacuna-nav, leave blank for none)"
- "What model should exploration use? (default: opus)"
- "What model should build use? (default: sonnet)"
- "Should build use 1M context? (default: yes)"
- "Where should the changelog file live?
  (default: CHANGELOG.md in project root)"
- "Is there a writing style skill you want to use for
  commit messages and summaries?
  (default: writing-clearly-and-concisely if available,
  leave blank to use built-in principles)"
- "Any other phases you want to tune from defaults?"

### /twisted-work interactive steps

1. Scan all lanes for existing objectives
2. Show status table using writing rules
3. Ask to resume or start new
4. If new: show pipeline, ask where to start
5. Invoke chosen skill

### /twisted-work status steps

1. Scan all lanes
2. Display status table with changelog path:
   ```
   Objectives:
   todo:
     - {objective-1} — {current phase} — {date}
   in-progress:
     - {objective-2} — {current phase} — {date}
   done:
     - {objective-3} — completed {date}
   Changelog: {files.changelog}
   ```
3. Exit without invoking any skill

### /twisted-work next / resume

- next: find most recently modified objective,
  advance to next phase
- resume: find named objective, invoke current phase
  (not next)

### /twisted-explore steps

1. Ask for objective name (or scout and suggest 3 names)
2. Create .twisted/todo/{objective}/
3. Recommend explore settings, wait for confirm
4. Spawn parallel research subagents
5. Write findings to objective folder using
   research_section template
6. Split into RESEARCH-1.md, RESEARCH-2.md etc if large
7. When complete, summarize and ask to hand off to
   /twisted-define

### /twisted-define steps

1. Find objective folder (todo/ or in-progress/)
2. Recommend define settings, wait for confirm
3. Read all RESEARCH-*.md
4. Aggressively question human — one category at a time,
   push back on vague answers, drill until concrete
5. Write REQUIREMENTS.md — no interpretation,
   capture exactly what was said
6. Ask to hand off to /twisted-plan

### /twisted-plan steps

1. Find objective folder in todo/
2. Recommend plan settings, wait for confirm
3. Read RESEARCH-*.md and REQUIREMENTS.md
4. Write ISSUES.md using issue template
5. Write PLAN.md with dependency-ordered parallel groups,
   each group completable in one session
6. Commit using commit_messages.plan with writing rules
7. Ask to hand off to /twisted-build

### /twisted-build steps

1. Find objective folder in todo/
2. Move todo/{objective}/ → in-progress/{objective}/
3. Commit lane move using writing rules
4. Recommend build settings, wait for confirm
5. Read ISSUES.md and PLAN.md from in-progress folder
6. Find first incomplete group
7. Create one worktree per issue:
   `git worktree add .twisted/worktrees/{objective}-issue-XXX -b {objective}/issue-XXX`
8. Spawn one subagent per worktree simultaneously
9. Each subagent:
   - Works only in its assigned worktree
   - Implements issue fully
   - Writes or updates tests
   - Passes all tests before reporting back
   - Marks [ x ] Done in ISSUES.md inside worktree
   - Commits implementation only — not ISSUES.md separately
   - Reports back with summary
10. When all report back:
    - Run spec compliance review per worktree
    - Run code quality review per worktree
    - Merge passing worktrees into main branch
    - ISSUES.md updates come in via merge —
      do NOT update again after merging
    - Clean up .twisted/worktrees/
11. Run /requesting-code-review on merged work
12. After each group ask to continue or stop
13. When all groups done, ask to hand off to /twisted-review

### /twisted-review steps

1. Find objective folder in in-progress/
2. Recommend review settings, wait for confirm
3. Run /requesting-code-review
4. Run /verification-before-completion
5. Summarize findings using writing rules
6. Ask to hand off to /twisted-accept

### /twisted-accept steps

1. Find objective folder in in-progress/
2. Recommend accept settings, wait for confirm
3. Generate changelog entry using template and writing rules:
   - What was built/changed/fixed
   - Issues resolved by group
   - Any deferred items and why
   - Key decisions made during the work
4. Check configured changelog path (files.changelog)
   - If exists: prepend entry, newest at top
   - If not: create at configured path
5. Move in-progress/{objective}/ → done/{objective}-[date]/
6. Commit using commit_messages.done with writing rules
7. Commit changelog at configured path
8. Run /finishing-a-development-branch
9. Summarize everything using writing rules
10. "Work accepted and branch closed. All done."

## Full Pipeline

```
/twisted-work init   ← one time setup
/twisted-work
  → /twisted-explore
  → /twisted-define
  → /twisted-plan
  → /twisted-build
  → /twisted-review
  → /twisted-accept
```

Enter at any point. /twisted-work detects existing
objectives and suggests the right entry point.