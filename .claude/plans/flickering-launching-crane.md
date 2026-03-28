# twisted-workflow Redesign: Research Synthesis

## Context

Investigating whether twisted-workflow's current architecture should be redesigned
to integrate with gstack, Nimbalyst, and Claude Code Agent Teams (with Superpowers
already integrated). This document captures raw findings and overlap analysis.

---

## Tool Landscape Summary

### gstack (v0.12.2.0) — Sprint Lifecycle as Specialist Roles

28 slash commands, each a specialist persona (CEO, eng manager, designer, QA lead, etc.).
Full sprint lifecycle: `/office-hours` → `/plan-ceo-review` → `/plan-eng-review` →
`/plan-design-review` → build → `/review` → `/qa` → `/ship` → `/land-and-deploy` →
`/canary` → `/retro`.

Key capabilities:
- **Headless browser** (`/browse`): Persistent Chromium daemon via compiled Bun binary, 50+ commands, ref system, ~100ms per call after cold start. Used by `/qa`, `/canary`, `/benchmark`.
- **Safety hooks** (`/freeze`, `/careful`, `/guard`): Real PreToolUse hooks (not prompts). Edit/Write locked to a directory.
- **Cross-model review** (`/codex`): OpenAI Codex CLI for adversarial second opinions.
- **Review Readiness Dashboard**: Tracks which reviews have been done, staleness detection. Hard gate at `/ship`.
- **Autoplan** (`/autoplan`): Chains CEO → design → eng review automatically.
- **Deploy automation** (`/ship`, `/land-and-deploy`, `/canary`): PR creation, deploy verification, post-deploy monitoring.
- **No MCP, no Agent Teams**: CLI-first, hooks for safety, files on disk for state, template-generated skills.
- **Parallel**: Via external tool Conductor. Session tracking via files. Each project gets isolated browser.

**Critical: gstack has NO /build command.** The build phase is deliberately left empty — after
planning, Claude Code writes code in its normal mode. The community recommends filling this gap
with Superpowers TDD. The established combo is: **gstack (plan/review/ship) + Superpowers (build/TDD).**

Real-world usage patterns (from guides, tutorials, community projects):
- People skip steps freely — the flow is modular, not enforced
- **gstack-auto** (community): Spawns N parallel implementations from one spec, scores them, picks winner
- **Code Conductor** (community): Git worktree task-claiming for parallel implementation
- **gstack + Nimbalyst**: Zero evidence of combined use (greenfield opportunity)
- **gstack + Agent Teams**: No integration (greenfield opportunity)
- Community tools prove demand for parallel execution coordination — the exact gap twisted-workflow fills

### Nimbalyst (v0.56.17) — Visual Session & Task Manager

Electron desktop app + iOS companion. Three modes: Files, Agent, Task.

Key capabilities:
- **Session kanban** (5 columns: Backlog → In Progress → Waiting → Review → Done): **Automatic state transitions** based on actual agent state. No manual updates.
- **Task kanban** (4 columns: Backlog → Planning → Implementing → Complete): For plan/work tracking.
- **Session configuration**: Model selection (Opus 4.6, Sonnet 4.6, 1M variants), effort level selector, context window, worktree toggle, plan mode, auto-approve, auto-continue, sleep prevention.
- **Workstreams**: Group related sessions. Drag-and-drop to create.
- **Agent Teams support**: Full lifecycle management of teammates/subagents. Each appears as a session.
- **Tracker tags**: `@task`, `@bug`, `@idea`, `@decision` (NOT `#task` — uses `@` prefix). Frontmatter: status, priority, progress, owner, stakeholders, dueDate.
- **Cross-session MCP tools** (v0.54.19): Query recent sessions, workstream overviews, session summaries, workstream-edited files.
- **Worktree management**: Auto-creates worktrees per session, visual diff review, merge within app.
- **iOS app**: Dashboard, start/resume sessions, visual diff review, push notifications, task queuing.
- **No public API or SDK. No published Claude Code plugin.**

### Nimbalyst Skills Ecosystem (3 repos, 63 skills/commands) — Stateless Single-Purpose Skills

30 skills (Nimbalyst/skills) + 14 developer commands + 19 PM commands. **All are prompt-only,
stateless, single-purpose.** No pipeline, no state machine, no cross-skill handoff, no session
spawning API, no Agent Teams coordination. Parallelism is intra-session only (Task tool subagents).

Key findings:
- **Every twisted-workflow phase has content overlap** but zero orchestration overlap:
  - Research: `deep-researcher` (parallel multi-agent), `competitive-analyst`, `feedback-analyzer`
  - Requirements: `prd-writer`, `edge-case-analyzer`
  - Planning: `/plan` command (YAML frontmatter with status lifecycle), `plan-implementer`
  - Execution: `plan-implementer`, `/validate-and-fix` (intra-session parallelism only)
  - Review: `branch-reviewer` (7+ parallel subagents), `/code-review` (6 parallel subagents)
  - Shipping: `/release-internal`, `/release-public`, `launch-announcer`
- **No programmatic session spawning.** No skill can create Nimbalyst sessions with model/effort configs.
- **Plan frontmatter schema** is well-designed and worth adopting:
  ```yaml
  planStatus:
    planId: plan-[id]
    status: draft | ready-for-development | in-development | in-review | completed | rejected | blocked
    planType: feature | bug-fix | refactor | system-design | research
    priority: low | medium | high | critical
    owner: [username]
    progress: 0-100
  ```
- **Work tracker tags**: `#[type][id:[type]_[ulid] status:to-do priority:medium created:YYYY-MM-DD]`
- **Only implicit handoff**: `/plan` creates file → `/implement` reads it. No routing, no state machine.
- **Nimbalyst expects skills to be filesystem-coordinated.** `nimbalyst-local/` is the convention.
  Skills write artifacts; humans (or other skills) read them. No orchestration layer exists.

**Critical implication:** Nimbalyst the APP provides kanban + session management + worktrees.
Nimbalyst's SKILLS provide individual phase content. Neither provides pipeline orchestration.
twisted-workflow's entire value is in the orchestration layer — the one thing Nimbalyst does not attempt.

### Current twisted-workflow (v1.2.0) — 6-Phase Kanban Pipeline

6 sequential phases: `/twisted-new` → `/twisted-define` → `/twisted-plan` → `/twisted-build` → `/twisted-review` → `/twisted-accept`.

Key capabilities:
- **Disk-based kanban**: `.twisted/todo/`, `.twisted/in-progress/`, `.twisted/done/` directories.
- **3-tier worktree hierarchy**: objective (from main) → group (from objective) → issue (from group). Issues within a group run in parallel.
- **Phase settings**: Per-phase model/effort/context/mode recommendations.
- **Structured requirements gathering** (`/twisted-define`): Aggressive one-category-at-a-time interrogation.
- **Session-independent state**: All state on disk, phases detected by file presence, resumable.
- **Superpowers integration**: TDD, systematic-debugging, requesting-code-review, verification-before-completion, finishing-a-development-branch.
- **Sparse config**: `.twisted/settings.json` merges with built-in defaults.

---

## Overlap Analysis

### What Nimbalyst Already Does Better

| twisted-workflow Feature | Nimbalyst Equivalent | Delta |
|---|---|---|
| Disk-based kanban lanes (todo/in-progress/done) | Visual session kanban with **automatic** state transitions | Nimbalyst is strictly better — real-time, visual, no manual folder moves |
| Phase detection by file presence | Agent state detection (running/waiting/done) | Nimbalyst detects actual agent state, not proxy files |
| Worktree creation/cleanup in /twisted-build | Per-session worktree toggle with visual merge | Nimbalyst handles lifecycle; twisted's 3-tier hierarchy adds group/issue isolation on top |
| Phase settings (model/effort per phase) | Session creation dialog with model, effort, context, worktree | Nimbalyst can configure per-session; twisted can recommend per-phase |
| Progress tracking via ISSUES.md checkboxes | Tracker with @tags, frontmatter, kanban views | Nimbalyst provides richer tracking with filtering, mobile access |

### What gstack Already Does Better

| twisted-workflow Feature | gstack Equivalent | Delta |
|---|---|---|
| /twisted-new (research) | /office-hours (brainstorming + design doc) | gstack has deeper persona modeling, anti-sycophancy, forcing questions |
| /twisted-define (requirements) | /plan-ceo-review (scope + strategy) | Different angle — gstack is CEO/founder perspective, twisted is requirements extraction |
| /twisted-plan (issue breakdown) | /plan-eng-review (architecture) + /plan-design-review (design) | gstack splits arch from design; twisted combines into issue breakdown |
| /twisted-review (verification) | /review (staff engineer) + /qa (live testing) | gstack adds browser-based QA, cross-model review, Greptile |
| /twisted-accept (closure) | /ship + /land-and-deploy + /canary | gstack has full deploy pipeline with monitoring |

### What twisted-workflow Does Uniquely (No Equivalent)

1. **3-tier parallel worktree hierarchy** (objective → group → issue): Neither gstack nor Nimbalyst provides structured parallel execution with dependency-ordered groups. gstack relies on Conductor externally; Nimbalyst provides session-level worktrees but no group/issue hierarchy.

2. **Structured requirements interrogation** (/twisted-define): Aggressive one-category-at-a-time extraction (scope, behavior, constraints, acceptance). gstack's CEO review is strategic, not requirements-focused. Superpowers' brainstorming is generative, not extractive.

3. **Session-independent state persistence**: The `.twisted/` directory structure lets any session resume at the exact phase. Nimbalyst provides session persistence but tied to its app; gstack has limited session state.

4. **Phase-to-phase handoff protocol**: Explicit artifacts flow between phases (RESEARCH → REQUIREMENTS → ISSUES/PLAN). Neither tool provides this structured artifact chain.

### Conflicts

1. **Worktree management**: twisted-workflow creates its own worktree hierarchy. Nimbalyst also creates worktrees per session. If a Nimbalyst session runs /twisted-build, both systems will try to manage worktrees → conflict.

2. **Kanban state**: twisted-workflow moves folders between directories. Nimbalyst tracks state automatically. These are parallel systems that can drift.

3. **Phase progression vs session lifecycle**: twisted-workflow's phases are sequential within an objective. Nimbalyst's sessions are independent. An objective spanning multiple sessions needs coordination that neither provides alone.

---

## Answers to Design Questions

### 1. Do manual phase handoffs still add value if Nimbalyst provides kanban visibility?

**Partially no.** Nimbalyst's automatic session kanban eliminates the need for manual folder moves and phase detection. However, the *artifact handoff* (RESEARCH → REQUIREMENTS → ISSUES → code) still adds value — Nimbalyst tracks session state, not artifact dependencies. The question becomes: should phase transitions be *Nimbalyst session boundaries* rather than folder moves within a single session?

### 2. Can Nimbalyst spawn sessions with specific model/effort configs?

**Yes.** Session creation supports model selection (Opus 4.6, Sonnet 4.6, 1M variants), effort level (for Opus), context window, worktree toggle, plan mode, and auto-approve. **However**, there is no programmatic API — sessions must be created through the UI. A skill cannot call `nimbalyst.createSession({model: "opus", effort: "max"})`. It can only *recommend* settings and ask the user to configure them in the Nimbalyst dialog.

**Limitation for Agent Teams**: Effort level cannot be set per-agent when spawning teammates — all inherit the lead session's effort. This is a Claude Code limitation (anthropics/claude-code#25591), not Nimbalyst-specific.

### 3. Does gstack's role structure map onto twisted-workflow phases or replace some?

**Partial replacement, partial complement.** Mapping:

| twisted-workflow Phase | gstack Equivalent | Verdict |
|---|---|---|
| /twisted-new (research) | /office-hours | **Replace** — gstack's persona is deeper |
| /twisted-define (requirements) | No direct equivalent | **Keep** — requirements extraction is unique |
| /twisted-plan (issue breakdown) | /plan-eng-review + /autoplan | **Complement** — gstack reviews architecture, twisted breaks into parallel issues |
| /twisted-build (execution) | No equivalent (external: Conductor) | **Keep** — parallel worktree execution is unique |
| /twisted-review (verification) | /review + /qa + /codex | **Replace** — gstack is much richer (browser QA, cross-model, Greptile) |
| /twisted-accept (closure) | /ship + /land-and-deploy | **Replace** — gstack has full deploy pipeline |

### 4. What does the optimal Nimbalyst tag format look like?

Nimbalyst uses `@task`, `@bug`, `@idea`, `@decision` — **not** `#task`. Frontmatter fields: `status`, `priority`, `progress`, `owner`, `stakeholders`, `dueDate`.

An optimal format for twisted-workflow objectives would be:
```markdown
---
status: in-progress
priority: high
progress: 4/7 issues complete
owner: claude
dueDate: 2026-03-28
---

@task Implement auth middleware refactor

## Issues
- @task [ISSUE-001] Extract token validation — **done**
- @task [ISSUE-002] Add session store — **done**
- @bug [ISSUE-003] Fix race condition in refresh — **in-progress**
```

However: the exact tag parsing rules are not publicly documented. We'd need to test whether Nimbalyst parses @task within issue lists or only at the top level.

### 5. When should Agent Teams vs Nimbalyst parallel sessions vs subagent worktrees be used?

| Mechanism | Best For | Limitation |
|---|---|---|
| **Agent Teams** (native Claude Code) | Tightly coupled subtasks that share context, need to communicate, and the lead agent needs results back | All teammates inherit lead's effort level; Nimbalyst visualizes but doesn't orchestrate |
| **Nimbalyst parallel sessions** | Independent workstreams with different model/effort configs, visual management, mobile monitoring | No inter-session coordination; sessions are independent |
| **Subagent worktrees** (twisted-workflow) | Parallel issues within a group that need structured merge back into a single branch | Heavier setup; requires group/issue hierarchy |

**Intelligent selection heuristic:**
- Issues with no dependencies + different config needs → Nimbalyst sessions
- Issues with no dependencies + same config + need structured merge → subagent worktrees (Agent Teams in worktrees)
- Issues with shared context or communication needs → Agent Teams (teammates)

---

## Gap Analysis: What a Redesigned twisted-workflow Should Be

All research confirms the picture. The ecosystem has a clear layered structure with one
critical gap:

| Layer | Tool | What It Provides |
|---|---|---|
| Specialist roles (plan/review/ship) | gstack | Deep personas, browser QA, deploy pipeline |
| Build discipline (TDD/debug/verify) | Superpowers | Implementation loop guardrails |
| Session management (visual) | Nimbalyst (app) | Kanban, worktrees, model/effort config, Agent Teams visibility |
| Phase content (individual) | Nimbalyst (skills) | Research, PRDs, edge cases, code review, releases |
| **Pipeline orchestration** | **??? (gap)** | **Decomposition, parallel execution, artifact flow, cross-session state** |

gstack deliberately leaves a /build gap. Superpowers fills the single-session build loop.
But nobody coordinates PARALLEL build across multiple agents/sessions with dependency
ordering and structured merge. Community tools (gstack-auto, Code Conductor) prove demand
for this exact capability. twisted-workflow's unique position is this orchestration layer.

---

## Design Decisions to Revisit

Every significant design choice in twisted-workflow v1, evaluated against what we now know
about gstack, Nimbalyst, Superpowers, and Agent Teams.

### A. Pipeline Shape (7 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| A1 | **6 discrete sequential phases** (new→define→plan→build→review→accept) | gstack has ~10 phases but modular entry. Nimbalyst skills are standalone. Should phases be fixed, configurable, or emergent? |
| A2 | **Each phase is a separate skill** (8 SKILL.md files) | More skills = more maintenance, more prompt loading. Could 3-4 skills cover it? |
| A3 | **Phases must complete sequentially** | Could research and scope overlap? Could review start before all groups finish? |
| A4 | **Phase detection by file presence** (RESEARCH exists → define next) | Brittle proxy. Frontmatter status field? Nimbalyst-compatible metadata? |
| A5 | **Manual handoffs with --yolo override** | gstack's /autoplan chains automatically. Should auto-advance be the default, with pause as the override? |
| A6 | **Shared config lives in using-twisted-workflow SKILL.md** | Works for plugin architecture, but is a 500-line skill the right place for defaults? |
| A7 | **Every phase skill loads the shared config skill first** | Token overhead on every invocation. Could config be cached or loaded differently? |

### B. State Management (7 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| B1 | **Disk-based kanban lanes** (todo/, in-progress/, done/) | Nimbalyst provides automatic visual kanban. Folder moves are redundant if Nimbalyst is present. |
| B2 | **Folder moves as state transitions** | Fragile (what if move fails mid-operation?). Frontmatter `status` field is atomic and Nimbalyst-compatible. |
| B3 | **Separate artifact files** (RESEARCH-*.md, REQUIREMENTS.md, ISSUES.md, PLAN.md) | Good for session independence, but 4-5 files per objective is heavy. Could ISSUES.md and PLAN.md merge? Could research be ephemeral? |
| B4 | **ISSUES.md checkbox tracking** (`[ ] Done` / `[x] Done`) | Nimbalyst uses @tags and frontmatter progress. gstack uses JSONL logs. Checkboxes are the simplest but least integrated. |
| B5 | **Objective naming** (user picks, scout suggests 3, or auto-increment) | Still reasonable, but should names match Nimbalyst Workstream names or git branch conventions? |
| B6 | **Single .twisted/settings.json per project** | No per-objective overrides. What if one objective needs Opus everywhere and another is fine with Sonnet? |
| B7 | **`.twisted/` as root directory** | Nimbalyst uses `nimbalyst-local/`. gstack uses `~/.gstack/` + `.gstack/`. Should twisted align with one convention? |

### C. Parallel Execution (9 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| C1 | **One issue per agent** | What if an issue is trivial (one-liner)? What if it's massive (needs its own decomposition)? Should agent:issue ratio be flexible? |
| C2 | **3-tier worktree hierarchy** (objective→group→issue) | Heavy setup. Nimbalyst creates worktrees per session. Agent Teams can use worktrees. Is the group tier necessary? |
| C3 | **Issues within a group have NO dependencies** | Good constraint for parallelism, but what about soft dependencies (issue B is easier if A is done first but doesn't require it)? |
| C4 | **Groups execute sequentially** | Could groups with no cross-dependencies run in parallel? Or is sequential simpler and good enough? |
| C5 | **Issue→group: normal merge** | Preserves history but creates noisy merge commits. Squash? Rebase? |
| C6 | **Group→objective: squash merge** | Clean history but loses individual issue commits. Is that desirable? |
| C7 | **Objective→main: normal merge at accept** | Or create a PR instead? gstack creates PRs via /ship. Nimbalyst has visual diff review. |
| C8 | **Code review between EVERY group merge** | High friction. What if there are 8 groups? Review after all groups? After critical groups only? Configurable? |
| C9 | **Tests must pass before subagent reports back** | What if the test framework isn't set up? What if tests are intentionally deferred? Should this be configurable? |

### D. Execution Strategy (5 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| D1 | **Subagents via Task tool (current approach)** | Agent Teams (teammates) now exist natively. Nimbalyst visualizes teammates as sessions. Should teammates replace Task tool subagents? |
| D2 | **No execution strategy selection** | One size doesn't fit all. Agent Teams, Nimbalyst sessions, subagent worktrees, or manual all have different tradeoffs. |
| D3 | **All issues in a group use same model/effort** | Agent Teams limitation (teammates inherit lead's effort). But different issues may warrant different capabilities. |
| D4 | **Subagents work only in assigned worktree** | Good isolation, but what if an issue needs to read files from another issue's worktree (e.g., shared types)? |
| D5 | **No mid-execution rebalancing** | If one agent finishes fast and another is stuck, no work stealing or reassignment. Should there be? |

### E. Phase Content (8 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| E1 | **Research via parallel codebase scouts** | gstack /office-hours has deeper persona. Nimbalyst deep-researcher has multi-agent classification. Is twisted's research phase adding value? |
| E2 | **Numbered research files** (RESEARCH-1.md, RESEARCH-2.md) | Why numbered files vs. a single synthesized output? Are these useful downstream or just noise? |
| E3 | **Aggressive one-category-at-a-time interrogation** (scope→behavior→constraints→acceptance) | Unique and valuable, but rigid. Should categories be configurable? Should some be skippable? |
| E4 | **"Capture exactly what human said — no interpretation"** | Good discipline, but requirements need synthesis. Should there be a synthesis step after faithful capture? |
| E5 | **Issue template** (type, area, file, current/target state, dependencies, group) | Right fields? Missing anything (estimated complexity, test strategy, acceptance criteria per issue)? |
| E6 | **Spec compliance review per issue worktree** | Valuable but slow. Is per-group enough? Per-objective? |
| E7 | **Changelog generation at accept** | Or delegate to gstack /document-release? Or Nimbalyst launch-announcer? |
| E8 | **Writing quality skill for all human-facing text** | Token overhead for marginal quality improvement? Or essential for professional output? |

### F. Integration Architecture (6 decisions)

| # | Current Decision | Why Revisit |
|---|---|---|
| F1 | **Superpowers integration is optional** | Should some Superpowers skills be mandatory (TDD during build, verification before accept)? |
| F2 | **No gstack integration** | gstack fills several phases better. How to delegate without hard dependency? |
| F3 | **No Nimbalyst integration** | Nimbalyst provides kanban, worktrees, session config. How to leverage without requiring it? |
| F4 | **No Agent Teams usage** | Agent Teams are native to Claude Code. Should they be the primary execution mechanism? |
| F5 | **Context skills injection** (`context_skills` array) | Good idea, but is it used? Does it add token overhead without clear value? |
| F6 | **No tool detection at runtime** | Should /twisted-work init scan for installed tools and auto-configure? |

**Total: 42 design decisions to revisit.**

---

---

## Design Decisions: Complete Resolution

All 42 design decisions resolved through discussion. Organized by category.

### Pipeline Shape (A)

| # | Decision | Resolution |
|---|---|---|
| A1 | Skill count and structure | **One user-facing skill** (`/twisted-work`) with param-driven sub-skills. Sub-skills (scope, decompose, execute) are internal files loaded on demand. Plus `using-twisted-workflow` for shared config. |
| A2 | Skills per phase | Collapsed from 8 to ~4 files total (1 user-facing + 1 config + 2-3 internal sub-skills) |
| A5 | Handoff behavior | **Auto-advance by default.** Pause only when model/effort/context configs change between steps or low context detected. Configurable override. |
| A6 | Config location | Keep in `using-twisted-workflow/SKILL.md` |
| A7 | Config loading | Loaded once by `/twisted-work`, passed to sub-skills |

### State Management (B)

| # | Decision | Resolution |
|---|---|---|
| B1 | Kanban mechanism | **Frontmatter first, folders default.** Frontmatter `status` is source of truth. Folder structure (todo/in-progress/done) mirrors frontmatter by default. Configurable to disable folders (flat `.twisted/{objective}/` with frontmatter only). |
| B2 | State transitions | **Atomic frontmatter update triggers folder move.** Status change in frontmatter → folder move follows. If folders disabled, only frontmatter changes. |
| B3 | Artifact files | **Keep current structure** (RESEARCH-*.md, REQUIREMENTS.md, ISSUES.md, PLAN.md). Align naming/format with gstack conventions where applicable. |
| B5 | Objective naming | Keep current approach (user picks, scout suggests, auto-increment fallback) |
| B6 | Per-objective config | Future consideration — single project config for now |
| B7 | Root directory | Keep `.twisted/` |

### Parallel Execution (C)

| # | Decision | Resolution |
|---|---|---|
| C1 | Agent:issue ratio | **Flexible.** Complexity estimation (Fibonacci/configurable) drives assignment: trivial (1-2) → batch, standard (3-5) → 1:1, large (8+) → auto-split. Thresholds configurable. |
| C2 | Worktree tiers | **Configurable, default 2 tiers** (objective → agent). Optional 3rd tier (group) for structured history. |
| C3 | Intra-group dependencies | **No soft dependencies.** Keep it simple — decompose more carefully instead. |
| C4 | Group execution order | **Parallel when independent, configurable.** Dependency analysis determines which groups can run concurrently. Can force sequential via config. |
| C5/C6 | Merge strategies | **Configurable, default normal merge** for agent→objective. Squash and rebase available. |
| C8 | Code review frequency | **Configurable.** Default: after all groups. Options: per-group, risk-based, after-all. |
| C9 | Test requirement | **Configurable, default tests-must-pass.** Strategies available: hard requirement, best-effort, deferred. |

### Execution Strategy (D)

| # | Decision | Resolution |
|---|---|---|
| D1 | Primary mechanism | **Task tool subagents.** Lead agent updates tracker in project root for Nimbalyst visibility. |
| D2 | Strategy selection | **Configurable** via `execution.strategy`. Options: task-tool (default), agent-teams, manual, auto. |
| D3 | Per-agent model/effort | Task tool allows per-subagent config. Agent Teams does not (inherits lead). Strategy choice affects this. |
| D5 | Mid-execution rebalancing | Not in v2 scope. Future consideration. |

### Phase Content (E)

| # | Decision | Resolution |
|---|---|---|
| E1 | Research capabilities | **Built-in + delegation.** Built-in research as fallback, delegate to configured provider (gstack, Nimbalyst, Superpowers) when available. |
| E3 | Interrogation categories | **Configurable** with sensible defaults (scope, behavior, constraints, acceptance). |
| E5 | Issue template | **Fully configurable.** Default template includes: type, area, file, current/target state, dependencies, group, complexity estimate, done checkbox. Users can add/remove/modify fields. |
| E7 | Changelog | **Built-in + delegation.** Generate internally by default, delegate to gstack /document-release when configured. |
| E8 | Writing quality | **Keep, configurable.** Default writing skill when installed, fallback rules when not. |

### Integration Architecture (F)

| # | Decision | Resolution |
|---|---|---|
| F1 | Superpowers defaults | **Auto-detect and suggest.** During init, detect Superpowers and suggest as provider for relevant phases. No hard defaults. |
| F2 | gstack integration | **Configurable delegation.** gstack commands are provider options for delegatable phases. |
| F3 | Nimbalyst integration | **Lead-agent tracker updates** in project root. Nimbalyst's worktree system is closed-loop; can't discover external worktrees. |
| F4 | Agent Teams | **Available as execution strategy** option, not default. User configures explicitly. |
| F6 | Tool detection | **`/twisted-work init` scans and configures.** `/twisted-work config` subcommand to rescan/reconfigure anytime. |

### Nimbalyst Worktree Finding

Nimbalyst's worktree system is a **closed loop**: it only tracks worktrees it creates itself.
No auto-discovery, no file watching (GitHub issue #21 open), no external signaling mechanism.
twisted-workflow worktrees will be invisible to Nimbalyst. Integration is via lead-agent
tracker updates in the project root only.

---

## v2 Architecture Specification

### Skill Structure

```
twisted-workflow/
├── CLAUDE.md
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/
│   ├── twisted-work/SKILL.md              ← only user-facing skill
│   ├── using-twisted-workflow/SKILL.md    ← shared config, defaults, templates
│   ├── twisted-scope/SKILL.md             ← internal: research + requirements
│   ├── twisted-decompose/SKILL.md         ← internal: issue breakdown
│   └── twisted-execute/SKILL.md           ← internal: parallel execution
├── README.md
└── CHANGELOG.md
```

### Command Interface

```
/twisted-work                          → auto-detect state, run next step
/twisted-work init                     → first-time setup, tool detection, config wizard
/twisted-work status                   → show all objectives and their states
/twisted-work status {objective}       → show detailed state for one objective
/twisted-work next                     → auto-advance active objective
/twisted-work next {objective}         → advance named objective
/twisted-work next --yolo              → auto-advance without pausing
/twisted-work resume {objective}       → resume named objective
/twisted-work scope                    → explicitly trigger scope step
/twisted-work decompose                → explicitly trigger decompose step
/twisted-work execute                  → explicitly trigger execute step
/twisted-work review                   → explicitly trigger review delegation
/twisted-work ship                     → explicitly trigger ship delegation
/twisted-work config                   → show full config overview
/twisted-work config tools             → show/edit detected tools
/twisted-work config pipeline          → show/edit pipeline providers
/twisted-work config pipeline research → drill into research provider
/twisted-work config execution         → show/edit execution strategy
/twisted-work config phases            → show/edit phase model/effort settings
/twisted-work config decompose         → show/edit estimation, thresholds
/twisted-work config templates         → show/edit issue/changelog templates
/twisted-work config writing           → show/edit writing skill config
/twisted-work config state             → show/edit state management (folders on/off)
```

### Full Config Schema

```json
{
  "version": "2.0",

  "tools": {
    "detected": {
      "gstack": false,
      "superpowers": false,
      "nimbalyst_skills": false
    },
    "last_scan": null
  },

  "pipeline": {
    "research": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    },
    "arch_review": {
      "provider": "skip",
      "fallback": "skip",
      "options": {}
    },
    "code_review": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    },
    "qa": {
      "provider": "skip",
      "fallback": "skip",
      "options": {}
    },
    "ship": {
      "provider": "built-in",
      "fallback": "built-in",
      "options": {}
    }
  },

  "execution": {
    "strategy": "task-tool",
    "discipline": null,
    "worktree_tiers": 2,
    "group_parallel": true,
    "merge_strategy": "normal",
    "review_frequency": "after-all",
    "test_requirement": "must-pass"
  },

  "phases": {
    "scope": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "execute"
    },
    "decompose": {
      "model": "opus",
      "effort": "max",
      "context": "default",
      "mode": "plan"
    },
    "execute": {
      "model": "sonnet",
      "effort": "medium",
      "context": "1m",
      "mode": "execute"
    }
  },

  "decompose": {
    "estimation": "fibonacci",
    "batch_threshold": 2,
    "split_threshold": 8,
    "categories": ["scope", "behavior", "constraints", "acceptance"]
  },

  "templates": {
    "issue": {
      "fields": [
        { "name": "id", "format": "ISSUE-{id}" },
        { "name": "title", "type": "string" },
        { "name": "type", "type": "enum", "values": ["bug", "refactor", "feature", "test"] },
        { "name": "area", "type": "string" },
        { "name": "file", "type": "string" },
        { "name": "current_state", "type": "string" },
        { "name": "target_state", "type": "string" },
        { "name": "dependencies", "type": "list" },
        { "name": "group", "type": "number" },
        { "name": "complexity", "type": "number" },
        { "name": "done", "type": "checkbox" }
      ]
    },
    "changelog_entry": [
      "## {date} — {objective}",
      "### Completed",
      "{completed}",
      "### Deferred",
      "{deferred}",
      "### Decisions",
      "{decisions}"
    ]
  },

  "state": {
    "use_folders": true,
    "folder_kanban": {
      "todo": ".twisted/todo",
      "in_progress": ".twisted/in-progress",
      "done": ".twisted/done"
    }
  },

  "directories": {
    "root": ".twisted",
    "worktrees": ".twisted/worktrees"
  },

  "files": {
    "settings": ".twisted/settings.json",
    "changelog": "CHANGELOG.md",
    "changelog_sort": "newest-first"
  },

  "writing": {
    "skill": "writing-clearly-and-concisely",
    "fallback": true
  },

  "context_skills": [],

  "flow": {
    "auto_advance": true,
    "pause_on_config_change": true,
    "pause_on_low_context": true
  },

  "naming": {
    "strategy": "prefix",
    "increment_padding": 3
  }
}
```

### State File per Objective

Each objective has a `state.md` with frontmatter:

```yaml
---
objective: auth-refactor
status: in-progress
step: execute
steps_completed:
  - research
  - scope
  - decompose
steps_remaining:
  - execute
  - review
  - ship
group_current: 2
groups_total: 4
issues_done: 4
issues_total: 7
created: "2026-03-26"
updated: "2026-03-26T14:30:00Z"
tools_used:
  research: built-in
  discipline: superpowers:test-driven-development
---

# auth-refactor

Objective summary and notes.
```

### Directory Structure

With folders enabled (default):
```
.twisted/
├── settings.json
├── todo/
│   └── {objective}/
│       ├── state.md
│       ├── RESEARCH-*.md
│       └── REQUIREMENTS.md
├── in-progress/
│   └── {objective}/
│       ├── state.md
│       ├── RESEARCH-*.md
│       ├── REQUIREMENTS.md
│       ├── ISSUES.md
│       └── PLAN.md
├── done/
│   └── {objective}-{date}/
│       └── (all files)
└── worktrees/  (gitignored)
```

With folders disabled:
```
.twisted/
├── settings.json
└── {objective}/
    ├── state.md          ← status field determines kanban position
    ├── RESEARCH-*.md
    ├── REQUIREMENTS.md
    ├── ISSUES.md
    └── PLAN.md
```

### Step Flow (auto-advance behavior)

```
/twisted-work
  ├─ read state.md → determine current step
  ├─ check: does next step require different model/effort/context?
  │   ├─ yes → pause, recommend config, wait for user
  │   └─ no → continue
  ├─ check: is context running low?
  │   ├─ yes → pause, suggest new session
  │   └─ no → continue
  ├─ load sub-skill for current step
  ├─ execute step
  ├─ update state.md (atomic frontmatter update)
  ├─ if state.use_folders: move folder to match new status
  ├─ check: more steps remaining?
  │   ├─ yes → loop (auto-advance)
  │   └─ no → done
  └─ if --yolo: skip all pauses
```

### Provider Format

Providers follow a `tool:command` format:

```
"built-in"                              → twisted-workflow's own implementation
"gstack:/office-hours"                  → invoke gstack command
"gstack:/review"                        → invoke gstack command
"gstack:/ship"                          → invoke gstack command
"superpowers:brainstorming"             → invoke Superpowers skill
"superpowers:requesting-code-review"    → invoke Superpowers skill
"superpowers:test-driven-development"   → invoke Superpowers skill
"nimbalyst:deep-researcher"             → invoke Nimbalyst skill
"nimbalyst:branch-reviewer"             → invoke Nimbalyst skill
"skip"                                  → omit this phase
"ask"                                   → ask user each time
```

### Complexity-Driven Agent Assignment

During decompose:
1. Each issue gets a complexity estimate (configurable scale, default Fibonacci)
2. Thresholds drive agent assignment:

| Complexity | Strategy | Example |
|---|---|---|
| ≤ `batch_threshold` (default 2) | Batch: group with other trivials into one agent | 3 one-line config changes → 1 agent |
| `batch_threshold` < x < `split_threshold` | Standard: 1 agent per issue | Normal feature work |
| ≥ `split_threshold` (default 8) | Split: auto-decompose into sub-issues, multiple agents | Major refactor → 3 sub-issues |

### Config Presets

Presets are **sparse overrides on defaults**, not full configs. Per-project settings
are sparse overrides on presets. Three-layer resolution:

```
Layer 1: Built-in defaults        ← complete, valid config (standalone, all built-in)
Layer 2: Preset (optional)        ← sparse delta from defaults
Layer 3: Per-project (optional)   ← sparse delta from resolved preset
```

Resolution: `deepMerge(defaults, presets[name] ?? {}, projectSettings ?? {})`

Simplest case: no preset, no project settings → pure defaults. Everything works.

Built-in presets (each is a sparse override, NOT a full config):

| Preset | What It Overrides From Defaults |
|---|---|
| `superpowers` | execution.discipline, pipeline.code_review provider |
| `gstack` | pipeline.research/arch_review/code_review/qa/ship providers |
| `gstack+superpowers` | Combines gstack + superpowers overrides |
| `full-stack` | gstack + superpowers + state.use_nimbalyst_tags |
| `minimal` | Sets research/arch_review/qa/review/ship to `skip` |

Settings.json example (Layer 3 override on Layer 2 preset):
```json
{ "preset": "gstack+superpowers", "execution": { "strategy": "agent-teams" } }
```

Init flow: detect tools → suggest best-fit preset → user confirms/changes → save to settings.json.

### Config Schema as TypeScript

The config schema is defined as `.d.ts` files for type safety, documentation, and
IDE support. Skills reference these types as the canonical schema definition.

```
types/
├── config.d.ts              ← root TwistedConfig, TwistedSettings, DeepPartial + re-exports
├── preset.d.ts              ← PresetName, PresetOverrides, built-in preset type map
├── tools.d.ts               ← ToolsConfig, ToolName, DetectedTools
├── pipeline.d.ts            ← PipelineConfig, PipelinePhase, ProviderString (template literal)
├── execution.d.ts           ← ExecutionConfig, ExecutionStrategy, MergeStrategy, ReviewFrequency, TestRequirement
├── phases.d.ts              ← PhaseSettings, ModelName, EffortLevel, ContextSize, PhaseMode
├── decompose.d.ts           ← DecomposeConfig, EstimationScale, ComplexityThresholds, InterrogationCategory
├── templates.d.ts           ← TemplateConfig, IssueTemplate, IssueField, ChangelogTemplate
├── state.d.ts               ← StateConfig, ObjectiveState, ObjectiveStatus, ObjectiveStep, StepTransitions
├── flow.d.ts                ← FlowConfig, PauseCondition
├── writing.d.ts             ← WritingConfig
├── directories.d.ts         ← DirectoryConfig, FilePathConfig
├── frontmatter.d.ts         ← ObjectiveFrontmatter, IssueFrontmatter, RequirementsFrontmatter, PlanFrontmatter
├── artifacts.d.ts           ← ResearchFile, RequirementsFile, IssuesFile, PlanFile, ExecutionLog
├── commands.d.ts            ← TwistedCommand, CommandParams, CommandFlags, ConfigDrilldown
└── issues.d.ts              ← Issue, IssueGroup, AgentAssignment, ComplexityEstimate, DependencyGraph
```

### Implementation Step 1: Write the .d.ts files [DONE]

17 type files written to `types/`. Covers config, presets, frontmatter, commands,
providers, issues, state machine, artifacts, pipeline, and string templates.

### Implementation Step 2: Write the skill files

See `HANDOFF.md` for complete instructions. Fresh session recommended.

Create: using-twisted-workflow, twisted-work, twisted-scope, twisted-decompose, twisted-execute
Delete: twisted-new, twisted-define, twisted-plan, twisted-build, twisted-review, twisted-accept
Update: plugin.json, marketplace.json

Key rule: every configurable value in a SKILL.md must reference the corresponding
type in `types/`. String templates from `types/strings.d.ts` define all user-facing text.

### Config Subcommand Behavior

Each `config` drill-down level:
1. Shows current values for that section
2. Explains what each setting does
3. Offers to modify any value
4. Validates changes against schema
5. Writes only changed keys (sparse override, same as v1)

Example: `/twisted-work config execution`
```
Execution Configuration:
  strategy:         task-tool    (options: task-tool, agent-teams, manual, auto)
  discipline:       null         (e.g., superpowers:test-driven-development)
  worktree_tiers:   2            (options: 1, 2, 3)
  group_parallel:   true         (run independent groups concurrently)
  merge_strategy:   normal       (options: normal, squash, rebase)
  review_frequency: after-all    (options: per-group, risk-based, after-all)
  test_requirement: must-pass    (options: must-pass, best-effort, deferred)

Which setting would you like to change?
```
