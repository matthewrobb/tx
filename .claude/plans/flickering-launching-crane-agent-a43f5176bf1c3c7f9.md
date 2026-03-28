# Nimbalyst Skills Ecosystem Research Report

## Executive Summary

Nimbalyst publishes three GitHub repositories of Claude Code skills/commands. They are **prompt-only** -- no MCP tool calls, no session spawning APIs, no agent team coordination, and no workflow orchestration. They are individual, self-contained skills that each handle one task. There is no pipeline, no state machine, no cross-skill handoff, and no kanban. twisted-workflow's core value proposition (multi-phase pipeline with session-independent state, parallel execution, and configurable phases) has no overlap at the skill-architecture level.

---

## 1. Repository Inventory

### Repo A: Nimbalyst/skills (30 skills)

Skills are organized into SKILL.md files under category directories. Each skill has YAML frontmatter with `name` and `description` fields. They are installable via `claude skills add`.

**Dev Skills (10):**

| Skill | What it does |
|-------|-------------|
| `branch-reviewer` | Read-only code review of branch changes. Launches 7+ parallel sub-agents (security, performance, compatibility, type safety, bugs, analytics, Jotai patterns). Compares against main. Delivers structured findings with quality scores 1-10. |
| `bug-reporter` | Conversational bug report creation. Asks clarifying questions one at a time. Produces formatted bug reports. |
| `claude-md-refactorer` | Extracts sections from a large CLAUDE.md into `docs/` with `.claude/rules/` path-scoped entries. |
| `code-analyzer` | Code quality analysis. Score, severity, improvement suggestions. |
| `commit-helper` | Impact-focused git commit messages. Uses `developer_git_commit_proposal` tool (Nimbalyst-specific). Type prefixes, issue linking. Explicitly says "Do NOT add Co-Authored-By." |
| `lib-updater` | Updates 3 specific Nimbalyst dependencies (@anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk, @openai/codex-sdk). Hardcoded to Nimbalyst's own packages. |
| `plan-implementer` | Reads a plan file (YAML frontmatter), extracts tasks as checkboxes, sets status to `in-development`, tracks progress %, finalizes to `in-review`. Uses TodoWrite internally. |
| `pre-commit-reviewer` | Reviews git diff for debug logs, dead code, TODOs. Comments out (not deletes) inappropriate logging. Checks plan status in frontmatter if committing a plan doc. |
| `standup-summary` | Summarizes recent git commits in standup format. Arguments: time period (1d, 2d, 1w). |
| `test-writer` | Generates tests using project's framework. Analyzes code, identifies cases, generates test code. |

**Product Skills (9):**

| Skill | What it does |
|-------|-------------|
| `edge-case-analyzer` | Identifies edge cases and error states during design. Detailed checklists for input validation, data states, system states, permissions, user flows, integrations. Outputs to `nimbalyst-local/Product/Edge-Cases/`. |
| `feature-explainer` | Explains features by inspecting codebase. Tailored for PM, designer, CS, or engineering audiences. Traces user journeys, maps dependencies, explains business logic. |
| `feedback-analyzer` | Analyzes customer feedback from surveys, interviews, support tickets, app reviews, NPS. Theme identification, sentiment, pain point extraction. Outputs to `nimbalyst-local/Product/Feedback/`. |
| `github-status` | Summarizes GitHub activity across repos, PRs, issues, team activity. |
| `prd-writer` | Creates structured PRDs with priorities (P0/P1/P2), user stories, metrics. Outputs to `nimbalyst-local/Product/PRDs/`. |
| `request-triager` | Triages, deduplicates, prioritizes feature requests. RICE scoring. **Has Linear MCP integration** -- mentions `mcp__linear__list_teams` and `mcp__linear__create_issue` for creating Linear issues from triaged requests. |
| `status-updater` | Executive status updates with metrics, blockers, next steps. |
| `strategy-memo` | Strategy memos with TL;DR, rationale, alternatives, implementation plan. |
| `work-tracker` | Tracks bugs/tasks/ideas/decisions in markdown. Uses ULID identifiers. Pattern: `#[type][id:[type]_[ulid] status:to-do priority:medium created:YYYY-MM-DD]`. Files in `nimbalyst-local/tracker/`. |

**Research Skills (4):**

| Skill | What it does |
|-------|-------------|
| `competitive-analyst` | Competitive analysis with SWOT, feature comparisons, pricing research. Outputs to `nimbalyst-local/Product/Competitive/`. |
| `customer-interview-sim` | Simulates customer interviews for practice. Claude acts as a realistic customer. Optional HubSpot MCP integration for logging insights. |
| `deep-researcher` | **Most architecturally interesting.** Multi-agent parallel research. Classifies queries (breadth-first/depth-first/simple), spawns 1-10 subagents via Task tool with `subagent_type="research-expert"`. Uses filesystem artifact pattern -- subagents write to `/tmp/research_*.md`, return only file paths. Synthesizes into final report. |
| `user-research-doc` | Templates for structuring user research findings. |

**Content Skills (5):**

| Skill | What it does |
|-------|-------------|
| `blog-writer` | Blog posts for Nimbalyst marketing. Specific voice/style rules. Outputs to `nimbalyst-local/Marketing/New Blogs/`. |
| `doc-writer` | Technical and product documentation. |
| `launch-announcer` | Launch announcements and release notes (internal, external, changelog). |
| `sales-enablement` | Battlecards, demo scripts, objection handling, customer personas, value propositions. Very comprehensive (12K+ chars). |
| `slide-deck-creator` | HTML slide decks (720x405pt) with Nimbalyst brand design system. 10 templates. Uses parallel sub-agents. |

**Meta Skills (1):**

| Skill | What it does |
|-------|-------------|
| `one-step-better-at-cc` | **33KB skill.** Personalized workflow optimization. Two modes: (1) Present next recommendation from queue, (2) Deep analysis -- runs /insights, web searches for 20+ influencer sources, analyzes project setup, generates 8-12 scored recommendations. Stores state in `.one-step-better-at-cc/data/` (profile.json, recommendation-queue.json, last-analysis.json). Has knowledge base of 50+ recommendations organized by category (NAV, EDIT, AUTO, MEM, VIS, NIMB, CTX, COLLAB, MISC). |

### Repo B: Nimbalyst/developer-claude-code-commands (14 commands)

These are Claude Code custom commands (`.claude/commands/` markdown files). Many overlap directly with skills from Repo A but are formatted as commands rather than skills.

| Command | Description | Notable details |
|---------|------------|----------------|
| `/plan` | Create plan documents | YAML frontmatter with planStatus (planId, title, status, planType, priority, owner, stakeholders, tags, created, updated, progress, dueDate, startDate). Statuses: draft, ready-for-development, in-development, in-review, completed, rejected, blocked. Plan types: feature, bug-fix, refactor, system-design, research. **Explicitly says "Plans are for PLANNING, not implementation. DO NOT include code blocks."** |
| `/implement` | Implement plan documents | Reads plan file, extracts acceptance criteria as checkboxes, updates frontmatter (status, progress %, timestamps). Uses TodoWrite. Finalizes to `in-review`. |
| `/code-review` | Multi-aspect code review | Uses 6 parallel sub-agents via Task tool: Architecture, Code Quality, Security & Dependencies, Performance & Scalability, Testing Quality, Documentation & API. Uses `allowed-tools` YAML frontmatter to restrict to Task and read-only git Bash. Consolidates into scored report. |
| `/review-branch` | Branch review | Read-only. Detailed checklist: database changes, security, performance, cross-platform compatibility, dependencies, logging, type safety, bugs, cleanup, analytics, CLAUDE.md documentation needs. |
| `/validate-and-fix` | Quality checks with auto-fix | Discovers available validation commands, runs in parallel, categorizes (CRITICAL/HIGH/MEDIUM/LOW), creates git stash checkpoint, fixes in phases with verification between each. Uses specialized subagents. |
| `/create-subagent` | Create domain expert subagents | Framework for building specialized agents. Must address 5-15 related problems. Files go to `.claude/agents/` or `~/.claude/agents/`. YAML frontmatter with name, description, optional tools field. |
| `/create-command` | Create new slash commands | Generates command files with YAML frontmatter, allowed-tools security controls. |
| `/commit` | Git commits | Same as commit-helper skill. Impact-focused messages, issue linking. |
| `/analyze-code` | Code analysis | Same as code-analyzer skill. |
| `/write-tests` | Test generation | Same as test-writer skill. |
| `/mockup` | UI mockups | Creates .mockup.html files. Distinguishes new screens vs. modifications. Checks for design system docs. Uses `mcp__nimbalyst-mcp__capture_mockup_screenshot`. |
| `/mychanges` | Standup summary | Same as standup-summary skill. |
| `/release-internal` | Internal release | Auto or interactive mode. Retrieves commits since last tag, creates dual release docs (developer CHANGELOG + public release notes), runs release script. |
| `/release-public` | Public release | Promotes internal release to public repo. Fetches latest public release via GitHub API, generates cumulative notes, triggers `publish-public.yml` GitHub Actions workflow. |

### Repo C: Nimbalyst/product-manager-claude-code-commands (19 commands)

PM-focused commands. Many are identical or near-identical to skills in Repo A.

| Command | Description | Notable overlap |
|---------|------------|----------------|
| `/plan` | Create plan documents | **Identical** to developer version |
| `/mockup` | UI mockups | **Identical** to developer version (same SHA) |
| `/prd` | PRD writing | Same as prd-writer skill |
| `/research` | Deep parallel research | **Identical** to deep-researcher skill |
| `/competitive` | Competitive analysis | Same as competitive-analyst skill |
| `/customer-interview` | Interview notes | Interview note-taking (not simulation). Saves to `nimbalyst-local/Product/Customer-Interviews/`. |
| `/customer-interview-simulate` | Simulated interviews | Same as customer-interview-sim skill. Has HubSpot MCP integration. |
| `/edge-cases` | Edge case analysis | Same as edge-case-analyzer skill |
| `/feedback-analyze` | Feedback analysis | Same as feedback-analyzer skill |
| `/triage-requests` | Request triage | Same as request-triager skill. Includes Linear MCP integration. |
| `/bug-report` | Bug reporting | Same as bug-reporter skill |
| `/understand-feature` | Feature explanation | Same as feature-explainer skill |
| `/status` | Status updates | Same as status-updater skill |
| `/github-status` | GitHub activity summary | Same as github-status skill |
| `/strategy` | Strategy memos | Same as strategy-memo skill |
| `/launch` | Launch announcements | Same as launch-announcer skill |
| `/sales-enablement` | Sales materials | Same as sales-enablement skill |
| `/documentation` | Documentation writing | Same as doc-writer skill |

**GitHub Actions:** One workflow (`zip.yml`) that creates a release artifact by zipping all tracked markdown files into `pm-ccc.zip`. Manual trigger with tag input.

---

## 2. Overlap Analysis with twisted-workflow Phases

### twisted-new (research/ideation)
**Overlapping Nimbalyst skills:**
- `deep-researcher` / `/research` -- parallel multi-agent research with query classification and filesystem artifacts
- `competitive-analyst` / `/competitive` -- competitive analysis, SWOT, feature comparisons
- `customer-interview-sim` / `/customer-interview-simulate` -- simulated customer interviews
- `feedback-analyzer` / `/feedback-analyze` -- feedback pattern analysis
- `user-research-doc` -- research findings templates

**Key difference:** twisted-new is one phase in a pipeline that produces a specific artifact (objective definition) which flows to the next phase. The Nimbalyst skills are standalone -- they produce documents but have no concept of "what comes next" or pipeline state.

### twisted-define (requirements gathering)
**Overlapping Nimbalyst skills:**
- `prd-writer` / `/prd` -- PRD creation with prioritized requirements
- `edge-case-analyzer` / `/edge-cases` -- edge case identification during design
- `feature-explainer` / `/understand-feature` -- understanding existing features for context

**Key difference:** twisted-define produces a structured spec that feeds twisted-plan. Nimbalyst PRDs are standalone documents with no pipeline connection.

### twisted-plan (planning/issue breakdown)
**Overlapping Nimbalyst skills:**
- `/plan` command -- creates plan documents with YAML frontmatter (planId, status, priority, owner, progress, etc.)
- `plan-implementer` / `/implement` -- reads plans and tracks implementation progress

**Key difference:** twisted-plan breaks work into parallelizable units for twisted-build. The Nimbalyst `/plan` creates a single document. The Nimbalyst plan system does have status tracking (draft -> ready-for-development -> in-development -> in-review -> completed) and progress percentages, but these are per-document, not coordinated across a pipeline.

### twisted-build (parallel execution)
**Overlapping Nimbalyst skills:**
- `plan-implementer` / `/implement` -- implements plan tasks with checkbox tracking
- `/validate-and-fix` -- parallel quality checks and auto-fix
- `/code-review` -- parallel sub-agent code review

**Key difference:** twisted-build manages multiple parallel sessions/workers executing different work items. Nimbalyst has NO concept of spawning parallel implementation sessions. Their parallelism is limited to sub-agents within a single session (e.g., code-review spawns 6 review agents, research spawns multiple research agents). They cannot spawn new Nimbalyst sessions with specific models, effort levels, or context configurations.

### twisted-review (review)
**Overlapping Nimbalyst skills:**
- `branch-reviewer` / `/review-branch` -- comprehensive read-only branch review
- `/code-review` -- multi-aspect code review with parallel agents
- `pre-commit-reviewer` -- cleanup before commit

**Key difference:** twisted-review is a pipeline gate -- it determines whether work passes or gets sent back. Nimbalyst reviews are advisory reports with no gating mechanism.

### twisted-accept (acceptance/shipping)
**Overlapping Nimbalyst skills:**
- `commit-helper` / `/commit` -- git commits
- `/release-internal` -- internal release workflow
- `/release-public` -- public release publishing
- `launch-announcer` / `/launch` -- launch announcements

**Key difference:** twisted-accept validates the full objective and marks it complete. Nimbalyst has no concept of objective-level acceptance.

---

## 3. Session Spawning and Model/Effort Configuration

**None of the skills or commands can programmatically create Nimbalyst sessions with specific model, effort, or context settings.**

The closest patterns found:
- `deep-researcher` uses `Task` tool with `subagent_type="research-expert"` to spawn research sub-agents. These are Claude Code sub-agents (Task tool invocations), not Nimbalyst sessions.
- `/code-review` uses `Task` tool to spawn 6 parallel code-review-expert sub-agents.
- `/validate-and-fix` uses `Task` tool for parallel fix agents.
- `one-step-better-at-cc` recommends `NIMB-014: Parallel Sessions for Large Refactors` -- but this is a human manual process ("Open multiple windows, assign subtasks, work simultaneously, link sessions, merge"), not programmatic.
- `one-step-better-at-cc` also mentions `CTX-003: Parallel Sessions for Migrations` using git worktrees -- again manual.

There is no API or tool for creating sessions. Nimbalyst's session management appears to be entirely GUI-driven.

---

## 4. Tracking, Handoff, and Artifact Patterns

### Plan Frontmatter System
The `/plan` and `/implement` commands use a structured YAML frontmatter system:

```yaml
planStatus:
  planId: plan-[unique-identifier]
  title: [title]
  status: draft | ready-for-development | in-development | in-review | completed | rejected | blocked
  planType: feature | bug-fix | refactor | system-design | research
  priority: low | medium | high | critical
  owner: [username]
  stakeholders: [list]
  tags: [list]
  created: "YYYY-MM-DD"
  updated: "ISO-8601"
  progress: 0-100
  dueDate: "YYYY-MM-DD"
  startDate: "YYYY-MM-DD"
```

Plans live in `nimbalyst-local/plans/`. The `/implement` command transitions: draft -> in-development (adding checkboxes, updating progress) -> in-review (when 100%).

### Work Tracker Tags
The `work-tracker` skill uses inline tag patterns:
```
Brief description #[type][id:[type]_[ulid] status:to-do priority:medium created:YYYY-MM-DD]
```
Files in `nimbalyst-local/tracker/` organized by type (Bugs, Tasks, Ideas, Decisions, Feature Requests, User Stories, Feedback, Tech Debt).

### File Location Convention
Nimbalyst uses a consistent `nimbalyst-local/` directory structure:
- `nimbalyst-local/plans/` -- plan documents
- `nimbalyst-local/tracker/` -- work items
- `nimbalyst-local/Product/PRDs/` -- PRDs
- `nimbalyst-local/Product/Edge-Cases/` -- edge case analyses
- `nimbalyst-local/Product/Feedback/` -- feedback analyses
- `nimbalyst-local/Product/Competitive/` -- competitive analyses
- `nimbalyst-local/Product/Customer-Interviews/` -- interview notes
- `nimbalyst-local/Marketing/` -- blogs, launches, sales enablement
- `nimbalyst-local/mockups/` -- UI mockups
- `nimbalyst-local/existing-screens/` -- cached screen replicas
- `nimbalyst-local/slides/` -- slide decks
- `nimbalyst-local/Notes/` -- documentation

### Cross-Skill Handoff
**There is no explicit cross-skill handoff mechanism.** Skills are independent. The only implicit connection is:
1. `/plan` creates a plan document
2. `/implement` reads that same plan document
3. `pre-commit-reviewer` checks plan status when committing plan files

This is the closest thing to a pipeline, and it is entirely file-based -- there is no state machine, no queue, no routing logic.

---

## 5. How Nimbalyst Expects Workflows to Be Built

Based on the evidence:

1. **Skills are single-purpose, stateless prompt packages.** The CONTRIBUTING.md states: "A focused skill that does one thing well is better than a bloated skill."

2. **No workflow orchestration framework.** Skills do not call other skills. There is no `/next` or pipeline concept. The user manually invokes each skill.

3. **File-system is the coordination layer.** Skills read/write to `nimbalyst-local/` directories. Handoff between phases happens because a human runs one skill, then another skill reads the output files.

4. **YAML frontmatter is the state schema.** Plan documents track status via frontmatter. This is the only structured state management.

5. **Sub-agents are for parallelism within a single task**, not for orchestrating a multi-phase pipeline. The Task tool is used in `deep-researcher`, `/code-review`, `/validate-and-fix`, and `slide-deck-creator` for parallel sub-work.

6. **The `one-step-better-at-cc` skill is the most workflow-aware.** It maintains persistent state across invocations (profile.json, recommendation-queue.json, last-analysis.json), runs dependency-ordered steps (insights -> web search -> project analysis -> queue generation), and has modal behavior. But it is self-contained -- it does not coordinate with other skills.

---

## 6. MCP Tool Usage

Very limited:
- `request-triager` / `/triage-requests`: References `mcp__linear__list_teams` and `mcp__linear__create_issue` for Linear integration
- `customer-interview-sim` (skills repo version): References HubSpot MCP `mcp__Hubspot__hubspot-create-engagement` for logging interview insights
- `/mockup` (developer commands): References `mcp__nimbalyst-mcp__capture_mockup_screenshot` for visual verification
- `one-step-better-at-cc`: Uses Skill tool to invoke `/insights`, uses WebSearch for influencer research

No skills use MCP tools for cross-session awareness or session management.

---

## 7. Agent Teams Integration

**No skills spawn teammates or coordinate parallel work across sessions.**

The parallelism patterns found are all **intra-session sub-agents** via the Task tool:
- `deep-researcher`: 1-10 research sub-agents
- `/code-review`: 6 review sub-agents
- `/validate-and-fix`: Multiple fix agents
- `branch-reviewer`: 7+ analysis sub-agents
- `slide-deck-creator`: Parallel slide-building agents

These are all within a single Claude Code conversation. There is no:
- TeamCreate / TeamDelete usage
- Cross-session coordination
- Shared state between parallel sessions
- Agent-to-agent messaging

---

## 8. Key Architectural Insights for twisted-workflow

### What Nimbalyst does well that twisted-workflow could learn from:
1. **The plan frontmatter schema** is well-designed (status, progress %, timestamps, priority, type, owner, stakeholders, tags). It could inform twisted-workflow's objective metadata.
2. **The filesystem artifact pattern** in deep-researcher (subagents write to /tmp, return paths not content) is a smart token optimization that twisted-workflow uses similarly.
3. **The work-tracker tag pattern** (`#[type][id:[type]_[ulid] status:to-do priority:medium]`) is an interesting inline-tag approach.
4. **Sub-agent parallelism via Task tool** with `subagent_type` parameter for specialized agents.

### What twisted-workflow provides that Nimbalyst completely lacks:
1. **Pipeline orchestration** -- phases connected by routing logic
2. **Cross-session state management** -- objectives tracked independently of sessions
3. **Parallel execution coordination** -- multiple workers on different tasks
4. **Review gates** -- pass/fail/rework decisions
5. **Auto-advancement** -- `/twisted-work next` detects phase and routes
6. **Session spawning with configuration** -- model, effort, context settings per task
7. **Kanban visualization** of work in progress

### Overlap summary:
The Nimbalyst ecosystem provides good **individual phase implementations** (research, planning, review, etc.) but has **zero workflow orchestration**. twisted-workflow's value is entirely in the orchestration layer -- the pipeline, state management, parallel execution, and phase routing -- which is the one thing Nimbalyst does not attempt.
