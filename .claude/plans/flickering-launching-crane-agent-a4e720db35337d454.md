# gstack Research Report

Comprehensive analysis of [github.com/garrytan/gstack](https://github.com/garrytan/gstack) v0.12.2.0 by Garry Tan (YC President/CEO).

---

## 1. Overview and Philosophy

gstack is a collection of SKILL.md files that turn Claude Code (and optionally Codex, Gemini CLI, Cursor) into a "virtual engineering team." Each skill is a specialist persona (CEO, eng manager, designer, QA lead, etc.) invoked as a slash command. The core insight: **structured roles + a persistent headless browser = a complete sprint process**.

The guiding philosophy is "Boil the Lake" -- AI makes completeness near-free, so always do the complete thing. A "lake" (100% test coverage, all edge cases) is achievable in minutes with AI. An "ocean" (multi-quarter rewrite) is not. Boil lakes, flag oceans.

**Current version:** 0.12.2.0
**License:** MIT
**28 slash commands total** (21 workflow skills + 7 power tools)

---

## 2. Complete Slash Command Inventory

### Sprint Lifecycle Skills (21)

| Command | Role/Persona | Parameters | What It Does |
|---------|-------------|------------|--------------|
| `/office-hours` | YC Office Hours Partner | None | Two modes: **Startup mode** (6 forcing questions: Demand Reality, Status Quo, Desperate Specificity, Narrowest Wedge, Observation & Surprise, Future-Fit) and **Builder mode** (generative brainstorm). Produces a design doc, not code. |
| `/plan-ceo-review` | CEO / Founder | None | 4 modes: SCOPE EXPANSION, SELECTIVE EXPANSION, HOLD SCOPE, SCOPE REDUCTION. 10-section review with premise challenge, alternatives, dream state mapping, temporal interrogation. |
| `/plan-eng-review` | Eng Manager | None | Architecture lockdown -- data flow, ASCII diagrams, edge cases, test matrix, failure modes. Interactive with opinionated recommendations. |
| `/plan-design-review` | Senior Designer | None | Rates each design dimension 0-10, explains what 10 looks like, then edits the plan to get there. AI Slop detection. Interactive. |
| `/design-consultation` | Design Partner | None | Builds complete design system from scratch. Researches landscape, proposes creative risks, generates mockups. Writes DESIGN.md. |
| `/review` | Staff Engineer | None | Pre-landing PR review. Two-pass: CRITICAL (SQL safety, race conditions, LLM trust boundary, enum completeness) then INFORMATIONAL (dead code, test gaps, performance). Auto-fixes obvious issues, flags ASK items. Includes scope drift detection, plan completion audit, test coverage diagram, Greptile integration. |
| `/investigate` | Debugger | None | 5-phase systematic debugging: Root Cause Investigation, Pattern Analysis, Hypothesis Testing (3-strike rule), Implementation, Verification & Report. Iron Law: no fixes without root cause. Auto-freezes to affected module. |
| `/design-review` | Designer Who Codes | None | Same audit as /plan-design-review but then fixes what it finds. Atomic commits, before/after screenshots. |
| `/qa` | QA Lead | `<url>`, `--quick`, `--regression <baseline>` | Tests live site with real browser. Three tiers: Quick (critical/high), Standard (+medium), Exhaustive (+cosmetic). Fixes bugs with atomic commits, generates regression tests, re-verifies. Before/after health scores. |
| `/qa-only` | QA Reporter | `<url>`, `--quick`, `--regression <baseline>` | Same methodology as /qa but report-only. Pure bug report, no code changes. Health score rubric: Console 15%, Links 10%, Visual 10%, Functional 20%, UX 15%, Performance 10%, Content 5%, Accessibility 15%. |
| `/cso` | Chief Security Officer | None | OWASP Top 10 + STRIDE threat model. Infrastructure-first: secrets archaeology, dependency supply chain, CI/CD pipeline, LLM/AI security. Two modes: daily (8/10 confidence gate) and comprehensive (monthly, 2/10 bar). |
| `/ship` | Release Engineer | None | Fully automated: merge base, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR. Bootstraps test frameworks if missing. Non-interactive except for merge conflicts, ASK items, or coverage failures. |
| `/land-and-deploy` | Release Engineer | None | Merge the PR, wait for CI and deploy, verify production health. Platform detection: Fly.io, Render, Vercel, Netlify, Heroku, GitHub Actions, custom. |
| `/canary` | SRE | `<url>`, `--duration <time>`, `--baseline`, `--pages <list>`, `--quick` | Post-deploy monitoring loop. Periodic screenshots, console errors, performance regressions. Alerts on changes vs baseline, not absolutes. Requires 2+ consecutive checks to alert (transient tolerance). |
| `/benchmark` | Performance Engineer | `<url>`, `--baseline`, `--quick`, `--pages <list>`, `--diff`, `--trend` | Page load times, Core Web Vitals, resource sizes. Compare before/after. Regression thresholds: >50% timing or >500ms absolute = REGRESSION, >25% bundle size = REGRESSION. |
| `/document-release` | Technical Writer | None | Reads all project docs, cross-references diff, updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md. CHANGELOG voice polish (never clobber). TODOS.md cleanup. Discoverability check. |
| `/retro` | Eng Manager | `global` | Weekly retro with per-person breakdowns, shipping streaks, test health trends. `/retro global` runs across all projects and AI tools. |
| `/codex` | Second Opinion | `review`, `challenge`, `consult` | Three modes via OpenAI Codex CLI: **review** (pass/fail gate), **challenge** (adversarial), **consult** (open session with continuity). Cross-model analysis when both /review and /codex have run. |
| `/autoplan` | Review Pipeline | None | One command, fully reviewed plan. Runs CEO -> design -> eng review automatically with 6 decision principles. Surfaces only taste decisions for user approval. |
| `/setup-browser-cookies` | Session Manager | `[browser]`, `--domain <d>` | Import cookies from real Chromium browser (Chrome, Arc, Brave, Edge) into headless session. Interactive picker UI or direct domain import. |
| `/setup-deploy` | Deploy Configurator | None | One-time setup for /land-and-deploy. Detects platform, production URL, deploy commands. Writes config to CLAUDE.md. |
| `/connect-chrome` | Browser Launcher | None | Launch real Chrome with Side Panel extension. Live activity feed, sidebar chat agent. |

### Power Tools (7)

| Command | What It Does |
|---------|-------------|
| `/careful` | Safety guardrails. Warns before rm -rf, DROP TABLE, force-push, git reset --hard, kubectl delete, docker system prune. Uses PreToolUse hooks on Bash. Safe exceptions for node_modules, .next, dist, etc. |
| `/freeze` | Edit lock. Restricts Edit and Write tools to one directory. Uses PreToolUse hooks. State stored in `~/.gstack/freeze-dir.txt`. Trailing slash prevents `/src` matching `/src-old`. |
| `/guard` | Full safety = `/careful` + `/freeze` combined. Single command, both hooks active. |
| `/unfreeze` | Removes freeze boundary. Deletes state file. |
| `/gstack-upgrade` | Self-updater. Detects global-git, local-git, or vendored install. 4 options: upgrade now, always auto-update, snooze (escalating backoff: 24h/48h/1wk), never ask again. Syncs local vendored copy if both exist. |
| `/connect-chrome` | Launch headed Chrome controlled by Playwright with Side Panel extension. `$B connect`, `$B disconnect`, `$B focus`, `$B handoff`, `$B resume`. |
| `/browse` | The root skill (SKILL.md at repo root). Persistent headless Chromium browser. Not invoked directly but loaded by every skill that needs browser access. |

---

## 3. How /freeze and /browse Work (Exact Mechanics)

### /freeze

**Mechanism:** Claude Code PreToolUse hooks, not prompt-only.

The SKILL.md YAML frontmatter declares hooks:
```yaml
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh"
```

**Setup flow:**
1. User invokes `/freeze`
2. AskUserQuestion asks which directory to restrict to (text input)
3. Directory resolved to absolute path, trailing slash appended
4. Written to `${CLAUDE_PLUGIN_DATA:-$HOME/.gstack}/freeze-dir.txt`

**Enforcement:** On every Edit or Write call, `check-freeze.sh` reads `file_path` from the tool input JSON, checks if it starts with the freeze directory. If not, returns `permissionDecision: "deny"`. Read, Bash, Glob, Grep are unaffected.

**Limitations:** Bash commands like `sed` can still modify files outside the boundary. This prevents accidental AI edits, not a security boundary.

**Deactivation:** `/unfreeze` deletes `freeze-dir.txt`. Hooks remain registered but allow everything since no state file exists.

### /browse

**Architecture:** Compiled Bun binary (`~58MB`) that talks to a persistent Chromium daemon over localhost HTTP.

```
Claude Code -> $B <command> -> CLI (compiled binary) -> HTTP POST localhost:PORT -> Bun.serve server -> Playwright -> Chromium (headless)
```

**State file:** `.gstack/browse.json` containing `{pid, port, token, startedAt, binaryVersion}`. Atomic write via tmp+rename, mode 0o600.

**Lifecycle:**
- First call: CLI finds no state file, spawns server. Server launches Chromium, picks random port 10000-60000, generates UUID bearer token, writes state file. ~3s.
- Subsequent calls: CLI reads state file, POST with bearer token. ~100-200ms.
- Idle shutdown: 30 min. Auto-restarts on next call.
- Crash: Server exits immediately. CLI detects dead server on next call and restarts fresh.
- Version auto-restart: Build writes git hash to `browse/dist/.version`. If binary version != running server's `binaryVersion`, CLI kills old server and starts new one.

**Security:** Localhost-only binding. Bearer token auth on every request (except /health and /cookie-picker). Cookies decrypted in-memory via PBKDF2+AES-128-CBC, never written to disk in plaintext.

**Ref system (`@e1`, `@e2`, `@c1`):** Based on Playwright's accessibility tree API, not DOM mutation. `page.locator(scope).ariaSnapshot()` returns ARIA tree, parser assigns sequential refs, builds Locator for each. No CSP issues, no framework conflicts. Refs cleared on navigation. Staleness detection via async `count()` check (~5ms).

**Key commands (50+):** Navigation (goto, back, forward, reload, url), Reading (text, html, links, forms, accessibility), Snapshot (snapshot with flags -i/-c/-d/-s/-D/-a/-o/-C), Interaction (click, fill, select, hover, type, press, scroll, wait, upload, dialog-accept/dismiss), Inspection (js, eval, css, attrs, is, console, network, dialog, cookies, storage, perf), Visual (screenshot with --viewport/--clip/element, pdf, responsive, diff), Tabs (tabs, tab, newtab, closetab), Server (connect, disconnect, focus, handoff, resume, restart, status, stop, state save/load), Meta (chain, frame, inbox, watch).

**Headed mode (`$B connect`):** Launches real Chrome via Playwright's `channel: 'chrome'`. Green shimmer line + "gstack" pill on controlled window. Side Panel extension shows live activity feed. Sidebar agent spawns child Claude instance for natural language browser commands.

**Multi-workspace:** Each project gets isolated browser in `.gstack/browse.json` with its own port. No shared state. Supports 10+ concurrent Conductor workspaces.

---

## 4. The Settings System

### Configuration Store

`~/.gstack/config.yaml` managed by `bin/gstack-config` CLI:

```bash
gstack-config get <key>
gstack-config set <key> <value>
```

**Known configuration keys:**
- `telemetry` -- `community` | `anonymous` | `off` (default: off)
- `proactive` -- `true` | `false` (default: true)
- `auto_upgrade` -- `true` | `false` (default: false)
- `update_check` -- `true` | `false` (default: true)
- `gstack_contributor` -- `true` | `false` (contributor mode)
- `skip_eng_review` -- `true` | `false` (skip eng review gate in /ship)

### State Files

All in `~/.gstack/`:
- `config.yaml` -- persistent configuration
- `sessions/` -- active session tracking (files touched per $PPID, cleaned after 2h)
- `analytics/skill-usage.jsonl` -- local usage analytics
- `analytics/eureka.jsonl` -- first-principles insights log
- `analytics/spec-review.jsonl` -- spec review quality metrics
- `contributor-logs/{slug}.md` -- field reports from contributor mode
- `freeze-dir.txt` -- active freeze boundary
- `.completeness-intro-seen` -- one-time flag for "Boil the Lake" intro
- `.telemetry-prompted` -- one-time flag for telemetry opt-in
- `.proactive-prompted` -- one-time flag for proactive suggestions opt-in
- `just-upgraded-from` -- version marker after upgrade
- `last-update-check` -- cached update check result
- `update-snoozed` -- snooze state with escalating backoff
- `projects/{slug}/` -- per-project persistent data (design docs, test outcomes, CEO plans, canary reports)

### Project-Level State

- `.gstack/browse.json` -- browser daemon state
- `.gstack/browse-console.log`, `browse-network.log`, `browse-dialog.log` -- browser event logs
- `.gstack/canary-reports/` -- canary baselines and screenshots
- `.gstack/benchmark-reports/` -- performance baselines
- `.gstack/qa-reports/` -- QA reports and screenshots
- `.gstack/no-test-bootstrap` -- opt-out marker for test framework setup

### Preamble-Based Configuration

Every skill runs a preamble bash block on load that checks:
1. Update availability (via `gstack-update-check`)
2. Active session count (files in `~/.gstack/sessions/` modified <2h)
3. Contributor mode status
4. Proactive suggestion preference
5. Repo mode (`solo` or `collaborative`)
6. First-run flags (completeness intro, telemetry, proactive)
7. Telemetry session tracking

When 3+ sessions are active, skills enter "ELI16 mode" -- every AskUserQuestion re-grounds the user on context because they are juggling windows.

### CLAUDE.md as Config

Deploy configuration from `/setup-deploy` is persisted to the project's `CLAUDE.md` under `## Deploy Configuration`. Test framework config also lives in CLAUDE.md's `## Testing` section. Platform-agnostic: skills never hardcode framework commands; they read CLAUDE.md first, then ask the user if missing.

---

## 5. Parallel Work Support

### Session Tracking

The preamble touches `~/.gstack/sessions/$PPID` and counts active sessions (files modified in last 2 hours). Old session files are cleaned up.

### Multi-Workspace Browser Isolation

Each project gets its own browser daemon with its own Chromium process, state file, port, cookies, and logs. State is stored in `.gstack/` inside the project root (detected via `git rev-parse --show-toplevel`). Random port selection (10000-60000) prevents collisions.

### Conductor Integration

The README describes [Conductor](https://conductor.build) as the external tool for running multiple Claude Code sessions in parallel -- each in its own isolated workspace. gstack's sprint structure is what makes this work: each agent knows exactly what to do and when to stop.

From the README: "I regularly run 10-15 parallel sprints -- that's the practical max right now."

### Git Worktree Support

The sidebar agent uses isolated git worktrees: "Each sidebar session runs in its own git worktree. The sidebar agent won't interfere with your main Claude Code session."

There is a `lib/worktree.ts` file in the repo, though the main skills don't appear to use worktrees directly -- they rely on Conductor to manage workspace isolation.

### Repo Mode Detection

`bin/gstack-repo-mode` detects whether the repo is `solo` or `collaborative`. This affects how pre-existing test failures are handled (solo: offer to fix; collaborative: blame + assign issue).

---

## 6. The Role/Persona System

Each skill defines a specialist persona in its SKILL.md frontmatter and prose. The personas are not generic prompts -- they contain detailed behavioral instructions.

### Persona Definitions (Key Examples)

**YC Office Hours Partner (`/office-hours`):**
- Two modes: Startup (diagnostic, confrontational) and Builder (enthusiastic collaborator)
- Anti-sycophancy rules: "Never say 'That's an interesting approach'" -- take a position instead
- Explicit pushback patterns with BAD/GOOD examples
- Response posture: "Be direct to the point of discomfort"
- 6 forcing questions asked ONE AT A TIME with smart-routing based on product stage
- Escape hatch: If user says "just do it" twice, respect it

**CEO/Founder (`/plan-ceo-review`):**
- 13 cognitive patterns from Bezos, Munger, Grove, Horowitz, Jobs, Hastings, Chesky, Graham, Altman
- 4 scope modes with explicit ceremonies (expansion opt-in, cherry-pick)
- 9 prime directives (zero silent failures, every error has a name, etc.)
- Dream state mapping (current -> this plan -> 12-month ideal)
- Temporal interrogation (Hour 1/2-3/4-5/6+ implementation decisions)

**Staff Engineer (`/review`):**
- Two-pass review: CRITICAL then INFORMATIONAL
- Scope drift detection with plan completion audit
- Test coverage ASCII diagrams with quality scoring (star system)
- E2E test decision matrix
- Greptile integration for external review comments
- Design review conditional on frontend scope detection
- Review Readiness Dashboard

**Debugger (`/investigate`):**
- Iron Law: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
- 5 phases: Root Cause -> Pattern Analysis -> Hypothesis Testing -> Implementation -> Verification
- 3-strike rule: If 3 hypotheses fail, STOP and escalate
- Auto-freeze to affected module via scope lock
- Red flags: "Quick fix for now" -> there is no "for now"
- Pattern table: race conditions, nil propagation, state corruption, integration failure, configuration drift, stale cache

### Shared Behaviors (from Preamble)

All skills share:
- **AskUserQuestion Format:** Re-ground (project/branch/task), Simplify (ELI16), Recommend (with Completeness score 1-10), Options (lettered, with effort estimates)
- **Completion Status Protocol:** DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT
- **Escalation:** "It is always OK to stop and say 'this is too hard for me.' Bad work is worse than no work."
- **Contributor Mode:** Rate gstack experience 0-10, file field reports for bugs
- **Search Before Building:** Three layers (tried-and-true, new-and-popular, first-principles). Prize Layer 3.
- **Telemetry:** Optional, 3 tiers (community/anonymous/off)

### Preamble Tiers

Skills declare a `preamble-tier` in frontmatter (1-4). From the template system, this controls which preamble sections are included. Higher tiers include more infrastructure (base branch detection, browse setup, QA methodology, etc.).

---

## 7. Integration Points

### OpenAI Codex CLI (`/codex`)

Three modes:
1. **Review:** `codex exec "<prompt>" -C "<repo>" -s read-only` with pass/fail gate
2. **Challenge:** Adversarial mode -- "try to break this code"
3. **Consult:** Open-ended session with `codex --session` for follow-ups

Cross-model analysis when both `/review` (Claude) and `/codex` (Codex) have reviewed the same branch.

Used in `/plan-ceo-review` and `/plan-eng-review` as optional "cross-model second opinion" after premises are established. Also used in `/review` for adversarial review auto-scaled by diff size (small diffs skip, medium get cross-model, large get 4 passes).

### Greptile Integration

`/review` checks for Greptile review comments on the PR and triages them (VALID & ACTIONABLE, VALID BUT ALREADY FIXED, FALSE POSITIVE, SUPPRESSED). Referenced via `.claude/skills/review/greptile-triage.md`.

### Chrome Extension (Side Panel)

- Live activity feed of browse commands via SSE streaming
- @ref overlays on page
- Sidebar chat: natural language -> child Claude instance executes in browser
- Toolbar badge showing server connection status
- Auto-loaded when `$B connect` launches Chrome

### GitHub / GitLab Support

All PR-targeting skills (ship, review, land-and-deploy, etc.) detect the git platform:
1. Check remote URL for "github.com" or "gitlab"
2. Fall back to `gh auth status` / `glab auth status`
3. Use platform-specific CLI (`gh` or `glab`) for PR/MR operations
4. Git-native fallback when no CLI available

### Supabase (Telemetry)

Opt-in telemetry stored in Supabase. Edge functions enforce schema checks. Local analytics always available via `gstack-analytics` from JSONL files.

### Conductor

External tool ([conductor.build](https://conductor.build)) for running multiple Claude Code sessions in parallel, each in isolated workspace. gstack is designed to work with it but does not depend on it.

### Multi-Agent Host Support

`./setup --host <host>` supports: `claude` (default), `codex`, `auto` (detect installed agents). Skills live in `.agents/skills/` for Codex-compatible hosts. Safety skills (careful, freeze, guard) use inline advisory prose on non-Claude hosts since hooks are Claude-specific.

---

## 8. Key Architectural Details

### SKILL.md Template System

SKILL.md files are **generated** from `.tmpl` templates by `scripts/gen-skill-docs.ts`. Templates contain human-written prose + placeholders filled from source code at build time:
- `{{PREAMBLE}}` -- startup block (update check, session tracking, contributor mode)
- `{{BROWSE_SETUP}}` -- binary discovery
- `{{COMMAND_REFERENCE}}` -- from `commands.ts`
- `{{SNAPSHOT_FLAGS}}` -- from `snapshot.ts`
- `{{BASE_BRANCH_DETECT}}` -- dynamic base branch detection
- `{{QA_METHODOLOGY}}` -- shared across /qa and /qa-only
- `{{DESIGN_METHODOLOGY}}` -- shared across /plan-design-review and /design-review
- `{{REVIEW_DASHBOARD}}` -- for /ship pre-flight
- `{{TEST_BOOTSTRAP}}` -- for /qa, /ship, /design-review
- `{{CODEX_PLAN_REVIEW}}` -- optional cross-model review

### Review Readiness Dashboard

Tracks review state across skills via JSONL entries logged by `gstack-review-log`. Displayed during `/ship`:
- **Required:** Eng Review (gates shipping unless `skip_eng_review` is set)
- **Optional:** CEO Review, Design Review, Adversarial Review, Outside Voice
- Staleness detection: compares stored commit hash against current HEAD
- Source attribution: shows which skill triggered the review (e.g., "via /autoplan")

### Spec Review Loop

Used in `/office-hours` and `/plan-ceo-review`. After writing a design doc or CEO plan:
1. Dispatch reviewer subagent via Agent tool (independent, fresh context)
2. Review on 5 dimensions: Completeness, Consistency, Clarity, Scope, Feasibility
3. Fix issues, re-dispatch. Max 3 iterations.
4. Convergence guard: if same issues repeat, persist as "Reviewer Concerns"

### Test Framework Bootstrap

`/ship` step 2.5 and `/qa`: If no test framework detected, offers to bootstrap one. Supports Ruby/Rails, Node.js/Next.js, Python, Go, Rust, PHP, Elixir. Creates config, example test, CI/CD pipeline (GitHub Actions), TESTING.md, updates CLAUDE.md. Opt-out marker: `.gstack/no-test-bootstrap`.

### Effort Compression Table

Present in every skill via the Completeness Principle:
| Task | Human team | CC+gstack | Compression |
|------|-----------|-----------|-------------|
| Boilerplate | 2 days | 15 min | ~100x |
| Tests | 1 day | 15 min | ~50x |
| Feature | 1 week | 30 min | ~30x |
| Bug fix | 4 hours | 15 min | ~20x |
| Architecture | 2 days | 4 hours | ~5x |
| Research | 1 day | 3 hours | ~3x |

---

## 9. Notable Design Decisions

1. **CLI over MCP:** gstack explicitly avoids MCP for browser automation. "MCP adds JSON schema overhead per request and requires a persistent connection. Plain HTTP + plain text output is lighter on tokens and easier to debug." In a 20-command session, MCP burns 30,000-40,000 tokens on protocol framing; gstack burns zero.

2. **No shared state between skills:** Skills communicate through files on disk (design docs, review logs, baselines, CLAUDE.md config) rather than in-memory state. This enables session independence.

3. **Hooks for safety, not prompts:** `/careful`, `/freeze`, and `/guard` use Claude Code's PreToolUse hooks (actual permission gates) rather than prompt instructions. This is a hard block, not a suggestion.

4. **Proactive skill suggestions:** When `proactive` is true (default), gstack contextually suggests skills based on what the user is doing. The mapping is explicit: brainstorming -> /office-hours, debugging -> /investigate, QA -> /qa, etc. Users can opt out with `gstack-config set proactive false`.

5. **Platform-agnostic design:** Skills never hardcode framework commands. They read CLAUDE.md first, ask the user if missing, then persist answers to CLAUDE.md for future sessions.

6. **No MCP servers or Claude Agents SDK dependency:** Everything is SKILL.md files (prompt templates), shell scripts in `bin/`, and one compiled Bun binary for the browser. The only runtime dependency beyond Claude Code itself is Bun for the browser binary.
