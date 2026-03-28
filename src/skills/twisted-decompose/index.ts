import type { SkillDefinition } from "../../lib/skill.js";

export const twistedDecompose: SkillDefinition = {
  frontmatter: {
    name: "twisted-decompose",
    description:
      "Internal sub-skill — complexity estimation, issue breakdown, dependency analysis, and execution planning",
  },
  content: `\
**REQUIRED:** Load the \`using-twisted-workflow\` skill for shared config, defaults, presets, string templates, and constraints. All section references below point to that skill.

# twisted-decompose

You are the decompose sub-skill, loaded by \`/twisted-work\`. You handle two pipeline steps: **arch_review** (delegation) and **decompose** (core). You are not user-invocable — \`/twisted-work\` loads you when needed.

## On Every Invocation

1. Receive the resolved config and objective state from \`/twisted-work\`.
2. Determine which step to execute: arch_review or decompose (from \`state.md\` frontmatter).
3. Execute the appropriate step below.

---

## Arch Review Step

### 1. Check Provider

Look up \`pipeline.arch_review.provider\` in the resolved config:

- If \`"skip"\`: mark arch_review complete, update \`state.md\`, return.
- If external provider: delegate per **Provider Delegation**, update \`state.md\`, return.

Arch review has no built-in implementation — it is always delegated or skipped.

### 2. Update State

Update \`state.md\` frontmatter:
- Add \`arch_review\` to \`steps_completed\`.
- Set \`step\` to \`decompose\`.
- Remove \`arch_review\` from \`steps_remaining\`.
- Record \`tools_used.arch_review\` with the provider used.
- Update \`updated\` timestamp.

---

## Decompose Step

### 1. Read Inputs

Read all \`RESEARCH-*.md\` and \`REQUIREMENTS.md\` from the objective folder. Build a complete picture of scope, constraints, and acceptance criteria.

### 2. Break Into Issues

Break the work into discrete issues using the configured \`templates.issue\` from the resolved config. Each issue must have all fields defined in the issue template.

Default issue fields (from \`IssueTemplate\`):

| Field | Type | Description |
|---|---|---|
| \`id\` | format \`ISSUE-{id}\` | Unique identifier |
| \`title\` | string | Short descriptive title |
| \`type\` | enum: bug, refactor, feature, test | Issue type |
| \`area\` | string | Area of the codebase affected |
| \`file\` | string | Primary file(s) to be modified |
| \`current_state\` | string | What exists now |
| \`target_state\` | string | What should exist after |
| \`dependencies\` | list | IDs of issues this depends on |
| \`group\` | number | Execution group (1-indexed) |
| \`complexity\` | number | Complexity estimate |
| \`done\` | checkbox | Completion status |

### 3. Estimate Complexity

For each issue, estimate complexity using the scale from \`decompose.estimation\`:

| Scale | Values |
|---|---|
| \`fibonacci\` | 1, 2, 3, 5, 8, 13, 21 |
| \`linear\` | 1–10 |
| \`tshirt\` | XS=1, S=2, M=3, L=5, XL=8, XXL=13 |
| \`custom\` | Values from \`decompose.custom_scale\` |

### 4. Assign Agents

Use complexity thresholds from \`decompose.batch_threshold\` and \`decompose.split_threshold\` to determine agent assignment:

| Complexity | Assignment | Behavior |
|---|---|---|
| ≤ \`batch_threshold\` (default: 2) | \`batch\` | Group with other trivial issues into one agent |
| > \`batch_threshold\` and < \`split_threshold\` | \`standard\` | One agent per issue |
| ≥ \`split_threshold\` (default: 8) | \`split\` | Auto-decompose into sub-issues, multiple agents |

For \`split\` issues: break the issue into smaller sub-issues, each with its own complexity estimate and agent assignment. Sub-issues inherit the parent's group.

### 5. Analyze Dependencies

Determine which issues depend on other issues. Rules:
- Issues within the same group must have no dependencies on each other.
- Issues in later groups may depend on earlier groups.
- Minimize the number of groups to reduce sequential bottlenecks.

### 6. Compute Parallel Groups

Organize issues into dependency-ordered groups (\`IssueGroup[]\`):
- Each group has a number (1-indexed), a list of issues, and a list of group dependencies.
- Compute \`parallel_with\` for each group — groups that share no dependencies and can run concurrently when \`execution.group_parallel\` is true.

### 7. Write ISSUES.md

Write \`ISSUES.md\` to the objective folder with \`IssuesFrontmatter\`:

\`\`\`yaml
---
objective: {objective}
created: "{date}"
updated: "{timestamp}"
total_issues: {count}
issues_done: 0
total_groups: {group_count}
estimation_scale: {scale}
---
\`\`\`

Content contains all issues formatted using the configured issue template, organized by group.

### 8. Write PLAN.md

Write \`PLAN.md\` to the objective folder with \`PlanFrontmatter\`:

\`\`\`yaml
---
objective: {objective}
created: "{date}"
updated: "{timestamp}"
total_groups: {group_count}
total_agents: {agent_count}
execution_order:
  - [1, 2]      # groups 1 and 2 can run in parallel
  - [3]          # group 3 depends on 1 and 2
  - [4, 5]      # groups 4 and 5 can run in parallel
---
\`\`\`

Content contains the dependency graph, execution order, agent assignment summary, and any notes about the execution strategy.

### 9. Commit

Commit both files using \`strings.commit_messages.plan\`.

### 10. Update State

Update \`state.md\` frontmatter:
- Add \`decompose\` to \`steps_completed\`.
- Set \`step\` to \`execute\`.
- Remove \`decompose\` from \`steps_remaining\`.
- Set \`groups_total\` to the number of groups.
- Set \`issues_total\` to the total issue count (including sub-issues).
- Record \`tools_used.decompose: "built-in"\`.
- Update \`updated\` timestamp.

### 11. Handoff

Display \`strings.handoff_messages.decompose_to_execute\` with issue count, group count, and total agents.

Return to \`/twisted-work\` for auto-advance to continue.

---

## Plan Mode

The decompose step uses **plan mode** (\`phases.decompose.mode: "plan"\`). Present the full issue breakdown, complexity estimates, group assignments, and execution plan for human review before writing any files. Only write ISSUES.md and PLAN.md after the human approves.

When \`--yolo\` is active: skip the review pause, write files immediately.

---

## Constraints

- Follow all **Shared Constraints** from \`using-twisted-workflow\`.
- All files go in the objective folder under its current lane.
- All human-facing text uses string templates from the resolved config.
- Issue template fields must match the configured \`templates.issue.fields\`.
- Complexity estimates must use the configured \`decompose.estimation\` scale.
- Agent assignments must respect the configured thresholds.
- Issues within a group must have no intra-group dependencies.
- State transitions are atomic — update all frontmatter fields at once.`,
};
