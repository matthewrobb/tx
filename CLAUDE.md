# twisted-workflow

A configurable orchestration layer for agentic development
with Claude Code — parallel execution, provider delegation,
session-independent state, and preset-based configuration.

## Project Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── src/                          ← runtime (Claude reads these via "read first")
│   ├── config/                   ← deepMerge, defaults, resolveConfig
│   ├── state/                    ← state machine, step sequencing, status mapping
│   ├── strategies/               ← artifact paths, strategy-aware writer, worktrees
│   ├── pipeline/                 ← provider routing, dispatch, pause logic
│   ├── scope/                    ← research, interrogation, requirements
│   ├── decompose/                ← complexity estimation, issue breakdown
│   ├── execute/                  ← parallel execution, delegation
│   ├── work/                     ← command routing, init, advance, config display
│   └── presets/                  ← typed preset definitions
├── build/                        ← tooling (generates skills, never read by Claude)
│   ├── build.ts                  ← bun run build
│   ├── lib/                      ← AST extraction, skill assembly
│   ├── skills/                   ← MarkdownDocument builders (5 files)
│   ├── schema/                   ← JSON Schema generator
│   ├── __tests__/                ← all tests (223)
│   └── __fixtures__/             ← test data
├── skills/                       ← generated SKILL.md (committed)
├── presets/                      ← generated preset JSON (committed)
├── schemas/                      ← generated JSON Schema (committed)
│   └── settings.schema.json
├── types/                        ← type definitions (18 .d.ts files)
├── README.md
└── CHANGELOG.md
```

## Architecture

`src/` is the source of truth. TypeScript functions with JSDoc
comments define all behavior. The build script extracts these
functions via the TypeScript compiler API and embeds them in
generated SKILL.md files as code blocks.

Generated skills tell Claude to "read first" the shared source
files and type definitions they depend on, then show the
skill-specific functions.

## Build

```
bun run build     # generates skills/, presets/, schemas/
bun test          # 223 tests across 13 files
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
