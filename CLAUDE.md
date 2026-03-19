# twisted-workflow

A kanban-style agentic development workflow for Claude Code
with parallel execution, session-independent state, and
configurable phases.

## Plugin Structure

```
twisted-workflow/
├── CLAUDE.md                        ← this file (dev instructions)
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   ├── using-twisted-workflow/SKILL.md  ← shared config skill
│   ├── twisted-work/SKILL.md
│   ├── twisted-new/SKILL.md
│   ├── twisted-define/SKILL.md
│   ├── twisted-plan/SKILL.md
│   ├── twisted-build/SKILL.md
│   ├── twisted-review/SKILL.md
│   └── twisted-accept/SKILL.md
├── README.md
└── CHANGELOG.md
```

## Architecture

The shared config, defaults, templates, and constraints
live in `skills/using-twisted-workflow/SKILL.md`. All
phase skills load this skill first and reference its
sections by name. This avoids CLAUDE.md auto-load issues
when the plugin is installed in other projects.

## Full Pipeline

```
/twisted-work init   ← one time setup
/twisted-work
  → /twisted-new
  → /twisted-define
  → /twisted-plan
  → /twisted-build
  → /twisted-review
  → /twisted-accept
```

Enter at any point. /twisted-work detects existing
objectives and suggests the right entry point.

## /twisted-work params

```
/twisted-work                    — interactive mode
/twisted-work init               — setup or update config
/twisted-work status             — show all objectives
/twisted-work next               — auto-advance active objective
/twisted-work next {objective}   — advance named objective
/twisted-work resume {objective} — resume named objective

Any command accepts --yolo to skip confirmations:
/twisted-work next --yolo
/twisted-new --yolo
/twisted-build --yolo
```

## Skill Behavior Reference

Detailed step-by-step behavior for each phase lives in
the individual SKILL.md files. The authoritative source
for config, defaults, templates, and rules is
`skills/using-twisted-workflow/SKILL.md`.
