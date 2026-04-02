# Retro: mattpocock-skills-integration

_Generated: 2026-04-02_

## Backlog Candidates

- [BC-001] Multi-agent planning poker: adversarial estimation with persona roles (pessimist, optimist, security, perf) plus human tiebreaker. Two-dimension estimation shape (story points + effort/complexity) was designed but not built. _(from deferral 1)_
- [BC-002] Agent personas: typed roles (build.md, planning.md, retro.md, review.md, research.md) in .claude/agents/twisted/ with per-role CLAUDE.md rules. tx init generation discussed but not built. _(from deferral 2)_
- [BC-003] tx commit wrapper: auto-format commit messages with epic/task refs, write hash back to tasks.json. Git hook generation via tx init. Design chosen (option C) but not implemented. _(from deferral 3)_
- [BC-004] Ralph integration: use Ralph's session-respawning loop as build-step execution harness while twisted-workflow manages state/artifacts. Identified as complementary, deferred. _(from deferral 4)_
- [BC-005] Daemon/concurrency: sock-daemon on-demand per-project server with idle timeout. File locking (proper-lockfile) as fallback. Architecture designed, not implemented. _(from deferral 5)_
- [BC-006] Cross-epic dependencies: depends_on between epics. User explicitly punted — only artifact-level within-epic dependencies kept in scope. _(from deferral 6)_
- [BC-007] Human-team features deferred: velocity/burndown tracking, sprint grouping/containers, generated .md board views, web UI, reporting formats. All explicitly marked don't-build-yet. _(from deferral 7)_
- [BC-008] Remaining v3 deferrals: v2-to-v3 migration tooling, config editing via CLI (tx config set), findRoot upward traversal (skip), npm publish workflow / CI. _(from deferral 8)_
