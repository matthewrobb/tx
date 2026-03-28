# twisted-workflow

A configurable orchestration layer for agentic development
with Claude Code — parallel execution, provider delegation,
session-independent state, and preset-based configuration.

## Plugin Structure

```
twisted-workflow/
├── CLAUDE.md                              ← this file (dev instructions)
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   ├── using-twisted-workflow/SKILL.md    ← shared config, defaults, presets, templates
│   ├── twisted-work/SKILL.md             ← only user-facing skill (router)
│   ├── twisted-scope/SKILL.md            ← internal: research + requirements
│   ├── twisted-decompose/SKILL.md        ← internal: issue breakdown + planning
│   └── twisted-execute/SKILL.md          ← internal: parallel execution + delegation
├── types/                                 ← canonical type definitions (17 .d.ts files)
├── presets/                               ← built-in preset JSON files (sparse overrides)
├── README.md
└── CHANGELOG.md
```

## Architecture

One user-facing skill (`/twisted-work`) routes to three
internal sub-skills (scope, decompose, execute) based on
objective state. Shared config, defaults, presets, and
string templates live in `skills/using-twisted-workflow/SKILL.md`.

The type system in `types/` is the canonical schema.
Every configurable value in a SKILL.md must match the
corresponding type definition.

## Pipeline

```
/twisted-work init     ← one time setup (tool detection, preset selection)
/twisted-work
  → research           ← delegatable (built-in or external provider)
  → scope              ← core (requirements interrogation)
  → arch_review        ← delegatable
  → decompose          ← core (issue breakdown + planning)
  → execute            ← core (parallel worktree execution)
  → code_review        ← delegatable
  → qa                 ← delegatable
  → ship               ← delegatable
```

Auto-advances by default. Pauses when phase settings change
or context is low. `--yolo` skips all pauses.

## /twisted-work params

```
/twisted-work                           — interactive mode
/twisted-work init                      — setup, tool detection, preset selection
/twisted-work status                    — show all objectives
/twisted-work status {objective}        — detailed status for one objective
/twisted-work next                      — auto-advance active objective
/twisted-work next {objective}          — advance named objective
/twisted-work resume {objective}        — resume named objective
/twisted-work scope                     — explicitly trigger scope step
/twisted-work decompose                 — explicitly trigger decompose step
/twisted-work execute                   — explicitly trigger execute step
/twisted-work review                    — explicitly trigger review delegation
/twisted-work ship                      — explicitly trigger ship delegation
/twisted-work config                    — show full config overview
/twisted-work config {section}          — drill into config section
/twisted-work config {section} {sub}    — drill into subsection

Any command accepts --yolo to skip confirmations:
/twisted-work next --yolo
```

## Config Resolution

Three-layer sparse override system with composable presets:

```
deepMerge(defaults, ...presets.map(load), projectSettings ?? {})
```

First preset wins — put the most important one first.
Built-in presets: standalone, superpowers, gstack,
nimbalyst, minimal.

## Skill Behavior Reference

Detailed step-by-step behavior for each phase lives in
the individual SKILL.md files. The authoritative source
for config, defaults, presets, templates, and rules is
`skills/using-twisted-workflow/SKILL.md`. The authoritative
source for type definitions is `types/`.
