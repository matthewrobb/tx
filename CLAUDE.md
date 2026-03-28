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
├── src/                                   ← TypeScript source (build input)
│   ├── build.ts                           ← bun run build
│   ├── config/                            ← config resolution, defaults, deepMerge
│   ├── state/                             ← state machine, status mapping
│   ├── strategies/                        ← artifact paths, writer, worktrees
│   ├── pipeline/                          ← provider routing, pause logic
│   ├── presets/                           ← typed preset definitions
│   ├── schema/                            ← JSON Schema generator
│   ├── skills/                            ← skill source (generates SKILL.md)
│   ├── __fixtures__/                      ← test fixtures
│   └── __tests__/                         ← integration tests
├── skills/                                ← generated SKILL.md files (committed)
│   ├── using-twisted-workflow/SKILL.md
│   ├── twisted-work/SKILL.md
│   ├── twisted-scope/SKILL.md
│   ├── twisted-decompose/SKILL.md
│   └── twisted-execute/SKILL.md
├── types/                                 ← canonical type definitions (18 .d.ts files)
├── presets/                               ← generated preset JSON (committed)
├── schemas/                               ← generated JSON Schema (committed)
│   └── settings.schema.json
├── README.md
└── CHANGELOG.md
```

## Architecture

TypeScript source in `src/` is the source of truth. The build
script generates SKILL.md files, preset JSON, and JSON Schema.
Generated files are committed to git.

**Functional core** — deterministic logic lives in `src/`:
- `src/config/` — deepMerge, defaults, resolveConfig
- `src/state/` — state machine, step sequencing, status mapping
- `src/strategies/` — artifact paths, strategy-aware writer, worktrees
- `src/pipeline/` — provider routing, pause logic

**Skills** reference this code instead of re-describing it in prose.
Prose is reserved for judgment calls, user interaction, and constraints.

## Build

```
bun run build     # generates skills/, presets/, schemas/
bun test          # runs all tests (218 tests)
```

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
deepMerge(defaults, ...presets.reverse().map(load), projectSettings ?? {})
```

First preset wins — put the most important one first.
Built-in presets: twisted, superpowers, gstack, nimbalyst, minimal.

## Tracking Strategies

`tracking: ["twisted"]` determines artifact format across
the full pipeline. First entry = primary. All entries written.

| Strategy | Research | Requirements | Plan/Issues |
|---|---|---|---|
| `twisted` | RESEARCH-*.md | REQUIREMENTS.md | ISSUES.md + PLAN.md |
| `nimbalyst` | nimbalyst-local/plans/ | same plan doc | checklist + tracker |
| `gstack` | DESIGN.md | DESIGN.md (append) | gstack PLAN.md + ISSUES.md |

## Skill Behavior Reference

Detailed step-by-step behavior for each phase lives in
the individual SKILL.md files. The authoritative source for
logic is `src/`. The authoritative source for type definitions
is `types/`.
