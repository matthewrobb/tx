---
objective: cli-tool
created: "2026-03-31"
updated: "2026-03-31"
total_issues: 16
issues_done: 0
total_groups: 4
estimation_scale: fibonacci
---

## Issues

- [ ] ISSUE-1: Define new type contracts (output, session, notes, tasks, updated state/pipeline/commands)
  - type: feature
  - area: types
  - complexity: 5
  - group: 1
  - dependencies: []

- [ ] ISSUE-2: Refactor state machine — 5-step pipeline (research/scope/plan/build/close)
  - type: refactor
  - area: state
  - complexity: 3
  - group: 1
  - dependencies: [1]

- [ ] ISSUE-3: Simplify config and presets (remove gstack/nimbalyst, new pipeline shape)
  - type: refactor
  - area: config
  - complexity: 5
  - group: 1
  - dependencies: [1]

- [ ] ISSUE-4: Implement notes system (decisions, deferrals, discoveries, blockers)
  - type: feature
  - area: notes
  - complexity: 2
  - group: 2
  - dependencies: [1]

- [ ] ISSUE-5: Implement tasks system (JSON-based, replaces issues.md)
  - type: feature
  - area: tasks
  - complexity: 2
  - group: 2
  - dependencies: [1]

- [ ] ISSUE-6: Implement session lifecycle (pickup/handoff, active tracking)
  - type: feature
  - area: session
  - complexity: 3
  - group: 2
  - dependencies: [1]

- [ ] ISSUE-7: Implement artifact read/write (path resolution, stdin piping)
  - type: feature
  - area: artifacts
  - complexity: 2
  - group: 2
  - dependencies: [1]

- [ ] ISSUE-8: Implement CLI argument parser (all commands, flags, shorthand)
  - type: feature
  - area: cli
  - complexity: 5
  - group: 3
  - dependencies: [1]

- [ ] ISSUE-9: Implement output formatters (agent JSON, human pretty-print)
  - type: feature
  - area: cli
  - complexity: 2
  - group: 3
  - dependencies: [1]

- [ ] ISSUE-10: Implement CLI entry point and filesystem layer (all command handlers)
  - type: feature
  - area: cli
  - complexity: 8
  - group: 3
  - dependencies: [2, 3, 4, 5, 6, 7, 8, 9]

- [ ] ISSUE-11: Update existing tests for new pipeline shape
  - type: test
  - area: tests
  - complexity: 5
  - group: 3
  - dependencies: [2, 3]

- [ ] ISSUE-12: Clean up deleted source files and update exports
  - type: refactor
  - area: cleanup
  - complexity: 3
  - group: 3
  - dependencies: [2, 3, 10]

- [ ] ISSUE-13: Refactor build system for thin wrapper skills
  - type: refactor
  - area: build
  - complexity: 8
  - group: 4
  - dependencies: [10, 11, 12]

- [ ] ISSUE-14: Add TypeScript compilation for distribution
  - type: feature
  - area: build
  - complexity: 2
  - group: 4
  - dependencies: [10]

- [ ] ISSUE-15: Final integration test and cleanup
  - type: test
  - area: tests
  - complexity: 5
  - group: 4
  - dependencies: [10, 11, 13, 14]

- [ ] ISSUE-16: Update documentation (CLAUDE.md, README.md, CHANGELOG.md)
  - type: docs
  - area: docs
  - complexity: 3
  - group: 4
  - dependencies: [15]

## Groups

### Group 1: Foundation (types + core refactors)
- ISSUE-1, ISSUE-2, ISSUE-3
- Total complexity: 13
- Parallel: ISSUE-2 and ISSUE-3 can run in parallel after ISSUE-1

### Group 2: New systems (notes, tasks, sessions, artifacts)
- ISSUE-4, ISSUE-5, ISSUE-6, ISSUE-7
- Total complexity: 9
- Parallel: all four can run in parallel (independent modules)
- Depends on: Group 1

### Group 3: CLI + integration
- ISSUE-8, ISSUE-9, ISSUE-10, ISSUE-11, ISSUE-12
- Total complexity: 23
- ISSUE-8 and ISSUE-9 parallel, then ISSUE-10 depends on everything
- Depends on: Group 1, Group 2

### Group 4: Build + distribution + docs
- ISSUE-13, ISSUE-14, ISSUE-15, ISSUE-16
- Total complexity: 18
- Depends on: Group 3
