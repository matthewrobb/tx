/**
 * Fixture data for objective states at various pipeline stages.
 */

import type { ObjectiveState } from "../../types/state.js";
import type { Issue, IssueGroup, DependencyGraph } from "../../types/issues.js";
import type { RequirementsFrontmatter } from "../../types/frontmatter.js";
import type { ResearchFrontmatter } from "../../types/frontmatter.js";

// ---------------------------------------------------------------------------
// Research fixtures
// ---------------------------------------------------------------------------

export const researchFindings = [
  {
    agentNumber: 1,
    focus: "authentication flow",
    findings: "Token validation happens in middleware/auth.ts. Session store uses Redis.",
    keyFiles: ["src/middleware/auth.ts", "src/services/session.ts"],
    patterns: ["middleware pattern", "repository pattern"],
    concerns: ["race condition in token refresh", "no rate limiting on auth endpoints"],
  },
  {
    agentNumber: 2,
    focus: "API surface",
    findings: "REST API with 12 endpoints. No OpenAPI spec. Auth required on all except /health.",
    keyFiles: ["src/routes/index.ts", "src/routes/users.ts"],
    patterns: ["express router", "controller pattern"],
    concerns: ["inconsistent error responses", "no input validation on POST /users"],
  },
];

export const researchFrontmatter: ResearchFrontmatter[] = [
  {
    objective: "auth-refactor",
    agent_number: 1,
    focus: "authentication flow",
    created: "2026-03-27",
    status: "done",
  },
  {
    objective: "auth-refactor",
    agent_number: 2,
    focus: "API surface",
    created: "2026-03-27",
    status: "done",
  },
];

// ---------------------------------------------------------------------------
// Requirements fixtures
// ---------------------------------------------------------------------------

export const requirementsFrontmatter: RequirementsFrontmatter = {
  objective: "auth-refactor",
  created: "2026-03-27",
  updated: "2026-03-27T14:30:00Z",
  categories_completed: ["scope", "behavior", "constraints", "acceptance"],
  categories_remaining: [],
  complete: true,
};

export const requirementsContent = {
  scope: [
    "Extract token validation into standalone module",
    "Replace Redis session store with JWT stateless auth",
    "Out of scope: OAuth provider integration",
  ],
  behavior: [
    "Token refresh must be atomic — no concurrent refresh race",
    "Expired tokens return 401 with refresh hint header",
    "Invalid tokens return 403 with no retry",
  ],
  constraints: [
    "Must maintain backward compatibility with existing session cookies for 30 days",
    "Token TTL: access 15min, refresh 7d",
    "No new dependencies — use existing jsonwebtoken package",
  ],
  acceptance: [
    "All existing auth tests pass",
    "New tests for token refresh race condition",
    "Load test: 1000 concurrent auth requests under 200ms p99",
  ],
};

// ---------------------------------------------------------------------------
// Issue fixtures
// ---------------------------------------------------------------------------

export const issues: Issue[] = [
  {
    id: "ISSUE-001",
    title: "Extract token validation module",
    type: "refactor",
    area: "auth",
    file: "src/middleware/auth.ts",
    current_state: "Token validation mixed into middleware",
    target_state: "Standalone token validation module",
    dependencies: [],
    group: 1,
    complexity: { value: 3, label: "3", assignment: "standard" },
    done: false,
  },
  {
    id: "ISSUE-002",
    title: "Add JWT signing utility",
    type: "feature",
    area: "auth",
    file: "src/services/jwt.ts",
    current_state: "No JWT support",
    target_state: "JWT sign/verify with configurable TTL",
    dependencies: [],
    group: 1,
    complexity: { value: 2, label: "2", assignment: "batch" },
    done: false,
  },
  {
    id: "ISSUE-003",
    title: "Implement atomic token refresh",
    type: "feature",
    area: "auth",
    file: "src/services/session.ts",
    current_state: "Race condition on concurrent refresh",
    target_state: "Mutex-based atomic refresh",
    dependencies: ["ISSUE-001"],
    group: 2,
    complexity: { value: 5, label: "5", assignment: "standard" },
    done: false,
  },
  {
    id: "ISSUE-004",
    title: "Update error responses",
    type: "bug",
    area: "api",
    file: "src/middleware/error.ts",
    current_state: "Inconsistent 401/403 responses",
    target_state: "401 with refresh hint, 403 with no retry",
    dependencies: ["ISSUE-001"],
    group: 2,
    complexity: { value: 1, label: "1", assignment: "batch" },
    done: false,
  },
  {
    id: "ISSUE-005",
    title: "Session cookie backward compatibility",
    type: "feature",
    area: "auth",
    file: "src/middleware/compat.ts",
    current_state: "No compatibility layer",
    target_state: "Dual auth: JWT + legacy session cookies for 30 days",
    dependencies: ["ISSUE-001", "ISSUE-003"],
    group: 3,
    complexity: { value: 5, label: "5", assignment: "standard" },
    done: false,
  },
];

export const issueGroups: IssueGroup[] = [
  {
    number: 1,
    issues: [issues[0]!, issues[1]!],
    depends_on: [],
    parallel_with: [],
  },
  {
    number: 2,
    issues: [issues[2]!, issues[3]!],
    depends_on: [1],
    parallel_with: [],
  },
  {
    number: 3,
    issues: [issues[4]!],
    depends_on: [1, 2],
    parallel_with: [],
  },
];

export const dependencyGraph: DependencyGraph = {
  groups: issueGroups,
  total_issues: 5,
  batched_agents: 1, // ISSUE-002 + ISSUE-004 batch (complexity ≤ 2)
  standard_agents: 3, // ISSUE-001, ISSUE-003, ISSUE-005
  split_agents: 0,
  total_agents: 4,
};

// ---------------------------------------------------------------------------
// State fixtures at various pipeline points
// ---------------------------------------------------------------------------

export const stateAtResearch: ObjectiveState = {
  objective: "auth-refactor",
  status: "todo",
  step: "research",
  steps_completed: [],
  steps_remaining: ["scope", "decompose", "execute", "code_review", "ship"],
  group_current: null,
  groups_total: null,
  issues_done: 0,
  issues_total: null,
  created: "2026-03-27",
  updated: "2026-03-27T10:00:00Z",
  tools_used: {},
};

export const stateAtScope: ObjectiveState = {
  ...stateAtResearch,
  step: "scope",
  steps_completed: ["research"],
  steps_remaining: ["decompose", "execute", "code_review", "ship"],
  updated: "2026-03-27T11:00:00Z",
  tools_used: { research: "built-in" },
};

export const stateAtDecompose: ObjectiveState = {
  ...stateAtResearch,
  step: "decompose",
  steps_completed: ["research", "scope"],
  steps_remaining: ["execute", "code_review", "ship"],
  updated: "2026-03-27T12:00:00Z",
  tools_used: { research: "built-in", scope: "built-in" },
};

export const stateAtExecute: ObjectiveState = {
  ...stateAtResearch,
  status: "in-progress",
  step: "execute",
  steps_completed: ["research", "scope", "decompose"],
  steps_remaining: ["code_review", "ship"],
  group_current: 1,
  groups_total: 3,
  issues_done: 0,
  issues_total: 5,
  updated: "2026-03-27T13:00:00Z",
  tools_used: { research: "built-in", scope: "built-in", decompose: "built-in" },
};

export const stateAtExecuteGroup2: ObjectiveState = {
  ...stateAtExecute,
  group_current: 2,
  issues_done: 2,
  updated: "2026-03-27T14:00:00Z",
};

export const stateComplete: ObjectiveState = {
  ...stateAtResearch,
  status: "done",
  step: "ship",
  steps_completed: ["research", "scope", "decompose", "execute", "code_review", "ship"],
  steps_remaining: [],
  group_current: null,
  groups_total: 3,
  issues_done: 5,
  issues_total: 5,
  updated: "2026-03-27T16:00:00Z",
  tools_used: {
    research: "built-in",
    scope: "built-in",
    decompose: "built-in",
    execute: "built-in",
    code_review: "built-in",
    ship: "built-in",
  },
};
