# twisted-workflow

A kanban-style agentic development workflow for Claude Code. Plan, build, and ship objectives with parallel execution, session-independent state, and a configurable phase pipeline.

## What it does

twisted-workflow gives Claude Code a structured, repeatable way to work through any objective — from a quick bug fix to a full feature redesign. Work is tracked in a `.twisted/` folder using a kanban structure (`todo/`, `in-progress/`, `done/`) so progress survives across sessions, context resets, and model switches.

Each objective moves through six phases:

```
explore → define → plan → build → review → accept
```

Every phase runs in its own session with the right model and effort level for the work. The build phase uses parallel git worktrees so multiple issues execute simultaneously without conflicts.

---

## Installation

```bash
# Add the marketplace
/plugin marketplace add {your-github-username}/twisted-workflow

# Install the plugin
/plugin install twisted@twisted-workflow
```

### First time setup

Run init once per project to create the `.twisted/` directory structure and configure your preferences:

```bash
/twisted-work init
```

This will:
- Create `.twisted/todo/`, `.twisted/in-progress/`, `.twisted/done/`, `.twisted/worktrees/`
- Add `.twisted/worktrees/` to `.gitignore`
- Ask you a few setup questions and write a sparse `settings.json` with only your customisations
- Commit the setup

---

## Quick Start

```bash
# See all objectives and their current phase
/twisted-work status

# Start a new objective
/twisted-work

# Auto-advance the most recently active objective
/twisted-work next

# Advance a specific objective
/twisted-work next my-objective

# Resume a specific objective at its current phase
/twisted-work resume my-objective
```

---

## The Pipeline

### `/twisted-explore` — Research
Spawns parallel subagents to research the codebase and any external sources simultaneously. Writes raw findings to the objective folder. Asks you to name the objective before writing any files.

**Recommended:** Opus, max effort, execute mode

### `/twisted-define` — Requirements
Reads the research files and aggressively questions you about what you want — one category at a time, pushing back on vague answers. Writes your answers to `REQUIREMENTS.md` exactly as given.

**Recommended:** Opus, max effort, execute mode

### `/twisted-plan` — Planning
Reads research and requirements, synthesizes a full execution plan. Writes `ISSUES.md` (every issue with severity, type, area, and parallel group) and `PLAN.md` (dependency-ordered groups). Commits the plan.

**Recommended:** Opus, max effort, plan mode

### `/twisted-build` — Execution
Moves the objective to `in-progress/`, then works through issue groups in parallel. Creates one git worktree per issue, spawns one subagent per worktree. Each subagent implements, tests, marks done, and commits. After each group: spec compliance review, code quality review, merge, cleanup. Runs `/requesting-code-review` between groups.

**Recommended:** Sonnet 1M, medium effort, execute mode

### `/twisted-review` — Verification
Runs `/requesting-code-review` and `/verification-before-completion`. Summarizes findings and fixes.

**Recommended:** Sonnet, medium effort, plan mode

### `/twisted-accept` — Completion
Writes a changelog entry (prepended to configured changelog, newest first), moves the objective folder to `done/`, commits, and runs `/finishing-a-development-branch`.

**Recommended:** Sonnet, low effort, execute mode

---

## Configuration

twisted-workflow uses a sparse config system. `.twisted/settings.json` stores only your customisations — everything else falls back to built-in defaults automatically. This means future plugin updates apply new defaults without you having to touch your config.

Run `/twisted-work init` at any time to view the complete merged config (your values + defaults) and update any settings.

### Example settings.json

```json
{
  "context_skills": ["/my-project-nav"],
  "phases": {
    "build": {
      "model": "sonnet",
      "context": "1m"
    }
  },
  "files": {
    "changelog": "docs/CHANGELOG.md"
  },
  "writing": {
    "skill": "writing-clearly-and-concisely"
  }
}
```

### Config reference

| Key | Default | Description |
|---|---|---|
| `context_skills` | `[]` | Skills injected at the start of every session |
| `writing.skill` | `"writing-clearly-and-concisely"` | Writing style skill for all human-facing text |
| `writing.fallback` | `true` | Use built-in writing principles if skill unavailable |
| `phases.{phase}.model` | varies | Model to recommend for each phase |
| `phases.{phase}.effort` | varies | Effort level: `low`, `medium`, `max` |
| `phases.{phase}.context` | varies | Context window: `default` or `1m` |
| `phases.{phase}.mode` | varies | Claude Code mode: `execute` or `plan` |
| `directories.todo` | `.twisted/todo` | Active planned objectives |
| `directories.in_progress` | `.twisted/in-progress` | Objectives currently being built |
| `directories.done` | `.twisted/done` | Completed objectives |
| `directories.worktrees` | `.twisted/worktrees` | Git worktrees (gitignored) |
| `files.changelog` | `CHANGELOG.md` | Path to changelog file |
| `naming.increment_padding` | `3` | Zero-padding for auto-named objectives |

### Phase defaults

| Phase | Model | Effort | Context | Mode |
|---|---|---|---|---|
| explore | opus | max | default | execute |
| define | opus | max | default | execute |
| plan | opus | max | default | plan |
| build | sonnet | medium | 1m | execute |
| review | sonnet | medium | default | plan |
| accept | sonnet | low | default | execute |

---

## Directory Structure

```
.twisted/
├── settings.json          — sparse config overrides
├── todo/
│   └── {objective}/       — planned, not started
│       ├── RESEARCH-1.md
│       ├── RESEARCH-2.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── in-progress/
│   └── {objective}/       — actively being built
├── done/
│   └── {objective}-[date]/ — completed and archived
└── worktrees/             — gitignored, local only
```

Files never move or get renamed — only the parent folder moves between lanes as the objective progresses.

---

## Using with project context skills

If your project has a context skill (like `/lacuna-nav` or `/my-project-context`), add it to `context_skills` in your settings:

```json
{
  "context_skills": ["/lacuna-nav"]
}
```

It will be injected automatically at the start of every twisted session. You can also pass an additional context skill at invocation time:

```bash
/twisted-explore my new feature using /my-extra-context
```

---

## Updating

```bash
/plugin update twisted@twisted-workflow
```

Because settings.json only stores your customisations, updates apply new defaults automatically without overwriting your config.

---

## How it works with Superpowers

twisted-workflow is designed to work alongside [obra/superpowers](https://github.com/obra/superpowers). Superpowers skills fire automatically throughout the pipeline:

- `test-driven-development` activates during `/twisted-build`
- `systematic-debugging` activates when issues arise
- `requesting-code-review` is called explicitly between groups
- `verification-before-completion` runs in `/twisted-review`
- `finishing-a-development-branch` runs in `/twisted-accept`

Install Superpowers alongside twisted-workflow for the full experience:

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

---

## License

MIT