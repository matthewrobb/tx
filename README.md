# twisted-workflow

> Kanban-style agentic development for Claude Code.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills: 7](https://img.shields.io/badge/skills-7-blueviolet)](.claude-plugin/plugin.json)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-plugin-orange)](https://claude.ai)

Plan, build, and ship objectives with parallel execution, session-independent state, and a configurable phase pipeline.

---

## Why twisted-workflow?

Claude Code sessions end. Context resets. Work gets lost.

twisted-workflow solves this with a `.twisted/` directory that tracks every objective through a kanban board (`todo/` -> `in-progress/` -> `done/`). Each objective carries its own research, requirements, issues, and plan. Pick up where you left off in any session, with any model.

The build phase creates one git worktree per issue and runs them in parallel — no merge conflicts, no waiting.

---

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

---

## The Pipeline

```
  new ────> define ──> plan ──> build ──> review ──> accept
  research   requirements  issues    parallel    verify     changelog
  & name     what & why    & groups  worktrees   & check    & close
```

Enter at any phase. `/twisted-work` detects existing objectives and picks the right entry point.

| Phase | What happens | Model | Mode |
|---|---|---|---|
| **new** | Name the objective, then parallel subagents research the codebase | opus | execute |
| **define** | Aggressive questioning — drills until requirements are concrete | opus | execute |
| **plan** | Synthesizes ISSUES.md and PLAN.md with dependency-ordered groups | opus | plan |
| **build** | One worktree per issue, one subagent per worktree, all in parallel | sonnet 1M | execute |
| **review** | Code review + spec compliance verification | sonnet | plan |
| **accept** | Changelog entry, move to done, close the branch | sonnet | execute |

Every phase recommends its settings and waits for your confirmation before starting. Override any value at invocation time.

---

## Commands

| Command | Action |
|---|---|
| `/twisted-work` | Interactive — scan objectives, resume or start new |
| `/twisted-work init` | Create `.twisted/` structure, configure settings |
| `/twisted-work status` | Show all objectives across all lanes |
| `/twisted-work next` | Advance the most recently active objective |
| `/twisted-work next {name}` | Advance a specific objective |
| `/twisted-work resume {name}` | Resume a specific objective at its current phase |

Run any phase directly:

```bash
/twisted-new        # start research
/twisted-define     # gather requirements
/twisted-plan       # create issues and plan
/twisted-build      # execute in parallel worktrees
/twisted-review     # verify the work
/twisted-accept     # write changelog, close out
```

---

## Directory Structure

```
.twisted/
├── settings.json            # sparse config (your overrides only)
├── todo/
│   └── {objective}/         # planned, not yet started
│       ├── RESEARCH-1.md
│       ├── RESEARCH-2.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── in-progress/
│   └── {objective}/         # actively being built
├── done/
│   └── {objective}-[date]/  # completed and archived
└── worktrees/               # gitignored, temporary
```

Files never rename. Only the parent folder moves between lanes.

---

## Configuration

`settings.json` stores only your overrides. Everything else falls back to built-in defaults. Plugin updates apply new defaults without touching your config.

Run `/twisted-work init` to view the full merged config and change any value.

### Example

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
| `files.settings` | `.twisted/settings.json` | Settings path |
| `naming.strategy` | `prefix` | Naming strategy |
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

---

## Context Skills

If your project has a navigation or context skill, add it to `context_skills`:

```json
{
  "context_skills": ["/my-project-nav"]
}
```

twisted-workflow injects these at the start of every phase automatically.

---

## Works With Superpowers

twisted-workflow integrates with [obra/superpowers](https://github.com/obra/superpowers). These skills activate automatically throughout the pipeline:

| Superpowers skill | Where it fires |
|---|---|
| `test-driven-development` | `/twisted-build` |
| `systematic-debugging` | When issues arise during build |
| `requesting-code-review` | Between groups in `/twisted-build`, in `/twisted-review` |
| `verification-before-completion` | `/twisted-review` |
| `finishing-a-development-branch` | `/twisted-accept` |

Install Superpowers for the full experience:

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

---

## FAQ

<details>
<summary><strong>Can I enter the pipeline mid-way?</strong></summary>

Yes. Run any phase skill directly (e.g., `/twisted-plan`). If the objective folder doesn't exist yet, the skill asks you to name it and creates the folder before proceeding.


</details>

<details>
<summary><strong>What happens if a session ends mid-build?</strong></summary>

All state lives in `.twisted/`. Run `/twisted-work` in a new session — it detects the objective's current phase and offers to resume.

</details>

<details>
<summary><strong>How do parallel worktrees work?</strong></summary>

During `/twisted-build`, each issue in a group gets its own git worktree branch. One subagent works in each worktree simultaneously. After all finish, passing worktrees merge back into the main branch and clean up.

</details>

<details>
<summary><strong>Do I need Superpowers installed?</strong></summary>

No. twisted-workflow works standalone. Superpowers skills enhance the pipeline with test-driven development, code review, and branch management — but they're optional.

</details>

<details>
<summary><strong>How do I change the changelog location?</strong></summary>

Set `files.changelog` in your settings:

```json
{ "files": { "changelog": "docs/CHANGELOG.md" } }
```

</details>

---

## License

MIT
