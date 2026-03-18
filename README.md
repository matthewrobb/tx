# twisted-workflow

A kanban-style agentic development workflow for Claude Code.

Plan, build, and ship objectives through six phases — with parallel execution, session-independent state, and a sparse config system that stays out of your way.

## How It Works

Claude Code sessions end. Context resets. Work disappears.

twisted-workflow stores every objective in a `.twisted/` directory organized as a kanban board: `todo/`, `in-progress/`, `done/`. Each objective carries its own research, requirements, issues, and plan. Start a session, run `/twisted-work`, and pick up exactly where you left off.

The build phase takes this further: one git worktree per issue, one subagent per worktree, all running in parallel. No merge conflicts. No serial bottlenecks.

## Quick Start

```bash
# Add the marketplace
/plugin marketplace add matthewrobb/twisted-workflow

# Install the plugin
/plugin install twisted-workflow@twisted-workflow

# Set up your project
/twisted-work init

# Start your first objective
/twisted-work
```

## The Pipeline

```
new ──> define ──> plan ──> build ──> review ──> accept
```

Enter at any phase. `/twisted-work` detects existing objectives and picks the right entry point.

| Phase | What happens | Model | Mode |
|---|---|---|---|
| **new** | Name the objective, spawn parallel research subagents | opus | execute |
| **define** | Drill requirements until concrete — one category at a time | opus | execute |
| **plan** | Write ISSUES.md and PLAN.md with dependency-ordered groups | opus | plan |
| **build** | Objective branch from main, issue worktrees in parallel, merge into objective | sonnet 1M | execute |
| **review** | Spec compliance check, then code quality review | sonnet | plan |
| **accept** | Merge objective into main, changelog, lane move to done | sonnet | execute |

Every phase recommends its model, effort, and mode settings, then waits for confirmation. Override anything at invocation time.

## Commands

| Command | What it does |
|---|---|
| `/twisted-work` | Scan objectives, resume or start new |
| `/twisted-work init` | Create `.twisted/` structure, configure settings |
| `/twisted-work status` | Show all objectives across all lanes |
| `/twisted-work next` | Advance the most recently active objective |
| `/twisted-work next {name}` | Advance a named objective to its next phase |
| `/twisted-work resume {name}` | Resume a named objective at its current phase |

Run any phase directly:

```bash
/twisted-new        # research and name
/twisted-define     # gather requirements
/twisted-plan       # create issues and execution plan
/twisted-build      # execute in parallel worktrees
/twisted-review     # verify the work
/twisted-accept     # write changelog, close out
```

Add `--yolo` to any command to skip confirmations and auto-advance through phases:

```bash
/twisted-work next --yolo
/twisted-new --yolo
```

## Directory Structure

```
.twisted/
├── settings.json                        # your overrides only
├── todo/
│   └── {objective}/                     # research, requirements, plan
│       ├── RESEARCH-1.md
│       ├── RESEARCH-2.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── in-progress/
│   └── {objective}/                     # actively being built
├── done/
│   └── {objective}-[date]/              # completed and archived
└── worktrees/                           # gitignored
    ├── {objective}/                     # objective branch (from main)
    ├── {objective}-group-N/             # group branch (from objective)
    └── {objective}-group-N-issue-XXX/           # issue branch (from group)
```

Files never rename. The parent folder moves between lanes. Worktrees are temporary — created during build, cleaned up as groups complete.

## Design Principles

- **Session-independent.** All state lives on disk. Resume from any session, any model, any context window.
- **Sparse config.** `settings.json` stores only your overrides. Built-in defaults fill the rest. Plugin updates apply new defaults without touching your config.
- **Parallel by default.** Research agents run in parallel. Build agents run in parallel worktrees. Serial work happens only when dependencies require it.
- **Human in the loop.** Every phase waits for confirmation before starting. Every handoff asks before advancing. Stop at any point and resume later.
- **Stack-agnostic.** Works with any codebase. No language or framework assumptions.

## Configuration

Run `/twisted-work init` to view the full merged config and change any value.

```json
{
  "context_skills": ["/my-project-nav"],
  "phases": {
    "build": { "model": "sonnet", "context": "1m" }
  },
  "files": {
    "changelog": "docs/CHANGELOG.md"
  },
  "writing": {
    "skill": "writing-clearly-and-concisely"
  }
}
```

<details>
<summary><strong>Full config reference</strong></summary>

| Key | Default | Description |
|---|---|---|
| `context_skills` | `[]` | Skills injected at the start of every phase |
| `writing.skill` | `"writing-clearly-and-concisely"` | Writing style skill for human-facing text |
| `writing.fallback` | `true` | Use built-in writing rules if skill unavailable |
| `phases.{phase}.model` | varies | Model per phase |
| `phases.{phase}.effort` | varies | `low`, `medium`, or `max` |
| `phases.{phase}.context` | varies | `default` or `1m` |
| `phases.{phase}.mode` | varies | `execute` or `plan` |
| `directories.root` | `.twisted` | Root directory |
| `directories.todo` | `.twisted/todo` | Planned objectives |
| `directories.in_progress` | `.twisted/in-progress` | Active objectives |
| `directories.done` | `.twisted/done` | Completed objectives |
| `directories.worktrees` | `.twisted/worktrees` | Temporary worktrees (gitignored) |
| `files.changelog` | `CHANGELOG.md` | Changelog path |
| `naming.increment_padding` | `3` | Zero-padding for auto-named objectives |

#### Phase defaults

| Phase | Model | Effort | Context | Mode |
|---|---|---|---|---|
| new | opus | max | default | execute |
| define | opus | max | default | execute |
| plan | opus | max | default | plan |
| build | sonnet | medium | 1m | execute |
| review | sonnet | medium | default | plan |
| accept | sonnet | low | default | execute |

</details>

## Works With Superpowers

twisted-workflow integrates with [superpowers](https://github.com/obra/superpowers). These skills fire automatically throughout the pipeline:

| Skill | Where |
|---|---|
| `test-driven-development` | During `/twisted-build` |
| `systematic-debugging` | When issues arise during build |
| `requesting-code-review` | Between groups in `/twisted-build`, in `/twisted-review` |
| `verification-before-completion` | `/twisted-review` |
| `finishing-a-development-branch` | `/twisted-accept` |

Superpowers is optional. twisted-workflow works standalone.

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

## FAQ

<details>
<summary><strong>Can I enter the pipeline mid-way?</strong></summary>

Yes. Run any phase skill directly (e.g., `/twisted-plan`). If the objective folder doesn't exist, the skill asks you to name it first.

</details>

<details>
<summary><strong>What happens if a session ends mid-build?</strong></summary>

All state lives in `.twisted/`. Run `/twisted-work` in a new session — it detects the current phase and offers to resume.

</details>

<details>
<summary><strong>How do parallel worktrees work?</strong></summary>

Three-tier worktree hierarchy. The objective gets a branch off main. Each group gets a branch off the objective. Each issue gets a branch off its group. One subagent works in each issue worktree simultaneously. Issue worktrees merge into the group branch. The group squash merges into the objective — one clean commit per group. The objective merges into main at `/twisted-accept`.

</details>

<details>
<summary><strong>How do I change the changelog location?</strong></summary>

Set `files.changelog` in `.twisted/settings.json`:

```json
{ "files": { "changelog": "docs/CHANGELOG.md" } }
```

</details>

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
