# twisted-workflow

A configurable orchestration layer for agentic development with Claude Code.

Decompose objectives into parallel issues, execute them across isolated worktrees, and delegate review/QA/shipping to your preferred tools — with session-independent state and preset-based configuration.

## How It Works

Claude Code sessions end. Context resets. Work disappears.

twisted-workflow stores every objective in a `.twisted/` directory organized as a kanban board: `todo/`, `in-progress/`, `done/`. Each objective carries its own state, research, requirements, issues, and plan. Start a session, run `/twisted-work`, and pick up exactly where you left off.

The execute step takes this further: one git worktree per agent, parallel execution across groups, configurable merge strategies. Delegatable phases route to external tools (gstack, Superpowers, Nimbalyst) or use built-in implementations.

## Quick Start

```bash
# Add the marketplace
/plugin marketplace add matthewrobb/twisted-workflow

# Install the plugin
/plugin install twisted-workflow@twisted-workflow

# Set up your project (detects tools, suggests preset)
/twisted-work init

# Start your first objective
/twisted-work
```

## The Pipeline

```
research ──> scope ──> arch_review ──> decompose ──> execute ──> code_review ──> qa ──> ship
```

Core steps (scope, decompose, execute) are always owned by twisted-workflow. Delegatable steps (research, arch_review, code_review, qa, ship) route to configured providers or skip entirely.

| Step | What happens | Default model | Mode |
|---|---|---|---|
| **research** | Parallel subagents explore the codebase | (delegatable) | execute |
| **scope** | Drill requirements one category at a time until concrete | opus | execute |
| **arch_review** | Architecture review before decomposition | (delegatable, skip by default) | — |
| **decompose** | Break into issues, estimate complexity, assign agents, plan groups | opus | plan |
| **execute** | Objective branch from main, parallel agent worktrees, group-by-group merge | sonnet 1M | execute |
| **code_review** | Full review of all changes on the objective branch | (delegatable) | — |
| **qa** | QA verification | (delegatable, skip by default) | — |
| **ship** | Merge to main, changelog, lane move to done | (delegatable) | — |

Auto-advances by default. Pauses when model/effort settings change between steps, context is running low, or `flow.auto_advance` is set to `false` (always pause).

## Commands

| Command | What it does |
|---|---|
| `/twisted-work` | Scan objectives, resume or start new |
| `/twisted-work init` | Create `.twisted/`, detect tools, select preset |
| `/twisted-work status` | Show all objectives across all lanes |
| `/twisted-work status {name}` | Detailed status for a single objective |
| `/twisted-work next` | Advance the most recently active objective |
| `/twisted-work next {name}` | Advance a named objective to its next step |
| `/twisted-work resume {name}` | Resume a named objective at its current step |
| `/twisted-work scope` | Explicitly trigger the scope step |
| `/twisted-work decompose` | Explicitly trigger decomposition |
| `/twisted-work execute` | Explicitly trigger parallel execution |
| `/twisted-work review` | Explicitly trigger code review delegation |
| `/twisted-work ship` | Explicitly trigger ship delegation |
| `/twisted-work config` | Show full config overview |
| `/twisted-work config {section}` | Drill into a config section |

Add `--yolo` to any command to skip confirmations and auto-advance:

```bash
/twisted-work next --yolo
```

## Directory Structure

```
.twisted/
├── settings.json                        # sparse overrides only
├── todo/
│   └── {objective}/
│       ├── state.md                     # frontmatter = source of truth
│       ├── RESEARCH-*.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── in-progress/
│   └── {objective}/
├── done/
│   └── {objective}-{date}/
└── worktrees/                           # gitignored
    ├── {objective}/                     # objective branch (from main)
    └── {objective}-agent-N/             # agent branch (from objective)
```

Frontmatter in `state.md` is the source of truth. Folders mirror frontmatter by default (configurable). Files never rename — the parent folder moves between lanes. Worktrees are temporary.

## Configuration

Run `/twisted-work init` to detect tools and select a preset. Run `/twisted-work config` to view and modify any setting.

Three-layer sparse override system with composable presets:

```
deepMerge(defaults, ...presets.reverse().map(load), projectSettings ?? {})
```

First preset wins — put the most important one first. `settings.json` stores only your overrides.

```json
{
  "presets": ["superpowers", "gstack"],
  "execution": { "strategy": "task-tool", "worktree_tiers": 2 },
  "files": { "changelog": "docs/CHANGELOG.md" }
}
```

### Presets

| Preset | What it overrides |
|---|---|
| `twisted` | twisted-workflow's own artifact format (ISSUES.md + PLAN.md) |
| `superpowers` | TDD discipline, code review → Superpowers |
| `gstack` | research, arch_review, code_review, qa, ship → gstack, gstack artifact format |
| `nimbalyst` | research, code review → Nimbalyst, nimbalyst artifact format |
| `minimal` | All delegatable phases → skip, tests deferred |

Compose them in any order. First preset wins on conflict:

| `presets` value | Effect |
|---|---|
| `[]` | Pure defaults |
| `["superpowers", "gstack"]` | Superpowers wins for code review (it's first), gstack fills in the rest |
| `["gstack", "superpowers"]` | gstack wins for code review (it's first), TDD discipline still applies |
| `["nimbalyst", "superpowers", "gstack"]` | Nimbalyst wins for research + code review, then Superpowers, then gstack |

<details>
<summary><strong>Preset comparison</strong></summary>

What each individual preset overrides from defaults:

| | twisted | superpowers | gstack | nimbalyst | minimal |
|---|---|---|---|---|---|
| **tracking** | `["twisted"]` | — | `["gstack"]` | `["nimbalyst"]` | — |
| **research** | — | — | gstack | nimbalyst | skip |
| **arch_review** | — | — | gstack | — | skip |
| **code_review** | — | superpowers | gstack | nimbalyst | skip |
| **qa** | — | — | gstack | — | skip |
| **ship** | — | — | gstack | — | skip |
| **discipline** | — | TDD | — | — | — |
| **tests** | — | — | — | — | deferred |

`—` = does not override (inherits from defaults or earlier preset)

### Resolved examples

What you actually get for common combinations (first preset wins):

| | `[]` | `["tw"]` | `["sp"]` | `["gs"]` | `["nim"]` | `["sp","gs"]` | `["nim","sp","gs"]` | `["min"]` |
|---|---|---|---|---|---|---|---|---|
| **tracking** | twisted | twisted | twisted | gstack | nimbalyst | gstack | nimbalyst | twisted |
| **research** | built-in | built-in | built-in | gstack | nimbalyst | gstack | nimbalyst | skip |
| **code_review** | built-in | built-in | sp | gstack | nimbalyst | sp | nimbalyst | skip |
| **discipline** | — | — | TDD | — | — | TDD | TDD | — |
| **tests** | must-pass | must-pass | must-pass | must-pass | must-pass | must-pass | must-pass | deferred |

tw = twisted, sp = superpowers, gs = gstack, nim = nimbalyst, min = minimal

</details>

<details>
<summary><strong>Full config reference</strong></summary>

| Key | Default | Description |
|---|---|---|
| `presets` | `[]` | Preset array, first wins on conflict |
| `context_skills` | `[]` | Skills injected at the start of every step |
| `writing.skill` | `"writing-clearly-and-concisely"` | Writing quality skill |
| `writing.fallback` | `true` | Use built-in writing rules if skill unavailable |
| `execution.strategy` | `"task-tool"` | `task-tool`, `agent-teams`, `manual`, `auto` |
| `execution.discipline` | `null` | Build discipline provider (e.g., `superpowers:test-driven-development`) |
| `execution.worktree_tiers` | `2` | `1` (flat), `2` (objective→agent), `3` (objective→group→agent) |
| `execution.group_parallel` | `true` | Run independent groups concurrently |
| `execution.merge_strategy` | `"normal"` | `normal`, `squash`, `rebase` |
| `execution.review_frequency` | `"after-all"` | `per-group`, `risk-based`, `after-all` |
| `execution.test_requirement` | `"must-pass"` | `must-pass`, `best-effort`, `deferred` |
| `decompose.estimation` | `"fibonacci"` | `fibonacci`, `linear`, `tshirt`, `custom` |
| `decompose.batch_threshold` | `2` | Complexity ≤ this → batch into one agent |
| `decompose.split_threshold` | `8` | Complexity ≥ this → auto-split into sub-issues |
| `decompose.categories` | `["scope", "behavior", "constraints", "acceptance"]` | Interrogation categories |
| `flow.auto_advance` | `true` | Auto-advance between steps (`false` = always pause) |
| `flow.pause_on_config_change` | `true` | Pause when next step has different settings |
| `flow.pause_on_low_context` | `true` | Pause when context is running low |
| `state.use_folders` | `true` | Use folder-based kanban lanes |
| `phases.scope` | `opus/max/default/execute` | Model/effort/context/mode for scope |
| `phases.decompose` | `opus/max/default/plan` | Model/effort/context/mode for decompose |
| `phases.execute` | `sonnet/medium/1m/execute` | Model/effort/context/mode for execute |
| `pipeline.{phase}.provider` | varies | Provider for each delegatable phase |
| `pipeline.{phase}.fallback` | varies | Fallback provider |
| `directories.root` | `".twisted"` | Root directory |
| `directories.worktrees` | `".twisted/worktrees"` | Worktree directory (gitignored) |
| `files.settings` | `".twisted/settings.json"` | Settings file path |
| `files.changelog` | `"CHANGELOG.md"` | Changelog path |
| `files.changelog_sort` | `"newest-first"` | `newest-first` or `oldest-first` |
| `state.folder_kanban` | `{todo, in_progress, done}` | Folder paths for kanban lanes |
| `naming.strategy` | `"prefix"` | Naming strategy for auto-generated names |
| `naming.increment_padding` | `3` | Zero-padding for auto-named objectives |
| `nimbalyst.enabled` | `false` | Write Nimbalyst-compatible tracker files |
| `nimbalyst.default_priority` | `"medium"` | Default priority for new objectives |
| `nimbalyst.default_owner` | `"claude"` | Default owner for tracked items |

</details>

## Nimbalyst Tracker Integration (Experimental)

When the nimbalyst preset is active (or `nimbalyst.enabled` is `true`), twisted-workflow writes files to `nimbalyst-local/` so Nimbalyst's Task Mode can discover them:

- **Plan file** in `nimbalyst-local/plans/{objective}.md` — full plan frontmatter (`planId`, `title`, `status`, `planType`, `priority`, `owner`, `progress`, etc.) with an implementation progress checklist
- **Tracker items** in `nimbalyst-local/tracker/tasks.md` — inline `#task`/`#bug` tags with ULID-based IDs in Nimbalyst's format: `- [desc] #task[id:task_[ulid] status:to-do priority:medium created:YYYY-MM-DD]`

Based on the Nimbalyst skills repos as of March 2026. See `using-twisted-workflow` for the full status mapping and update rules.

## Provider Delegation

Delegatable phases route to external tools:

| Format | Example |
|---|---|
| `"built-in"` | twisted-workflow's own implementation |
| `"gstack:/{command}"` | `"gstack:/office-hours"`, `"gstack:/review"` |
| `"superpowers:{skill}"` | `"superpowers:requesting-code-review"` |
| `"nimbalyst:{skill}"` | `"nimbalyst:deep-researcher"` |
| `"skip"` | Omit this phase |
| `"ask"` | Ask user each time |

## Works With

twisted-workflow integrates with these tools through provider delegation and presets:

| Tool | Integration |
|---|---|
| [Superpowers](https://github.com/obra/superpowers) | Build discipline (TDD), code review |
| [gstack](https://github.com/gstack) | Research, architecture review, code review, QA, shipping |
| [Nimbalyst](https://nimbalyst.com) | Deep research, branch review |

All integrations are optional. twisted-workflow works standalone.

## Complexity-Driven Agent Assignment

During decomposition, each issue gets a complexity estimate. Thresholds drive agent assignment:

| Complexity | Strategy | Example |
|---|---|---|
| ≤ batch threshold (2) | Batch into one agent | Three config changes → one agent |
| Standard range (3–7) | One agent per issue | Normal feature work |
| ≥ split threshold (8) | Auto-split into sub-issues | Major refactor → multiple agents |

## FAQ

<details>
<summary><strong>Can I enter the pipeline mid-way?</strong></summary>

Yes. Use explicit step subcommands like `/twisted-work scope` or `/twisted-work execute`. If the objective folder doesn't exist, the skill asks you to name it first.

</details>

<details>
<summary><strong>What happens if a session ends mid-execution?</strong></summary>

All state lives in `state.md` frontmatter. Run `/twisted-work` in a new session — it reads the frontmatter and offers to resume at the exact step and group.

</details>

<details>
<summary><strong>How do parallel worktrees work?</strong></summary>

Configurable worktree tiers. Default is 2 tiers: the objective gets a branch off main, each agent gets a branch off the objective. Agents work in parallel, merge back into the objective branch using the configured merge strategy. Optional 3rd tier adds group-level branches for structured history.

</details>

<details>
<summary><strong>How is this different from gstack or Nimbalyst?</strong></summary>

gstack provides specialist roles (plan/review/ship). Nimbalyst provides session management and visual kanban. twisted-workflow is the orchestration layer between them — it decomposes objectives into parallel issues, coordinates execution across worktrees, and delegates individual phases to whichever tool you prefer.

</details>

## JSON Schema

`/twisted-work init` adds a `$schema` reference to `settings.json` for VS Code autocomplete, validation, and inline descriptions. If editing settings manually, add:

```json
{
  "$schema": "path/to/schemas/settings.schema.json"
}
```

## Development

TypeScript source in `src/` is the source of truth for all behavior. The build script extracts real functions via the TypeScript compiler API and embeds them in generated SKILL.md files as code blocks. Generated files (skills, presets, schema) are committed to git.

```bash
bun install          # install dependencies
bun run build        # generate skills/, presets/, schemas/
bun test             # 223 tests across 13 files
```

**Runtime** (`src/`) — the code Claude reads at execution time:

| Module | Purpose |
|---|---|
| `src/config/` | Config resolution, defaults, deepMerge |
| `src/state/` | State machine, step sequencing, status mapping |
| `src/strategies/` | Artifact paths, strategy-aware writer, worktrees |
| `src/pipeline/` | Provider routing, dispatch, pause logic |
| `src/scope/` | Research, interrogation, requirements |
| `src/decompose/` | Complexity estimation, issue breakdown |
| `src/execute/` | Parallel execution, delegation |
| `src/work/` | Command routing, init, advance, config display |

**Tooling** (`build/`) — generates SKILL.md files, never read by Claude:

| Module | Purpose |
|---|---|
| `build/skills/` | MarkdownDocument builders (5 files) |
| `build/lib/` | TypeScript AST extraction, skill assembly |
| `build/schema/` | JSON Schema generator |
| `build/__tests__/` | 223 tests including 12 filesystem scenarios |

## Contributing

Issues and pull requests welcome at [matthewrobb/twisted-workflow](https://github.com/matthewrobb/twisted-workflow).

## Updating

```bash
claude plugin update twisted-workflow@twisted-workflow
```

Settings stay intact — `settings.json` stores only your overrides, so new defaults apply automatically.

---

## License

MIT
