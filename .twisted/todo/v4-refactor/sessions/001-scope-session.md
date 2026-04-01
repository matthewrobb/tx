## Session: Scope Step for v4-refactor

### Completed
- Advanced from research to scope step
- Wrote scope artifact with 4-phase plan
- Scoping decisions made via interactive Q&A

### Key Decisions
1. Phased delivery: P0 runtime, P1 core engine + daemon, P2 estimation + retro, P3 stories + agents
2. Runtime switch first (P0): full Bun to Node.js + npm + vitest
3. Daemon in P1: sock-daemon ships with core engine, no lockfile fallback
4. XState v5: confirmed as state machine
5. tx commit deferred: git hooks orthogonal to core
6. tx migrate scrapped: not needed
7. Stories last (P3): after everything else works
8. Skill rename: twisted-work to tx
9. Agent -a output: must use Claude Code idioms (/tx next, AskUserQuestion) not bare CLI

### Next
- /tx next to enter plan step
- Plan should break P0-P3 into concrete tasks with dependency ordering
