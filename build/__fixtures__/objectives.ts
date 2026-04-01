/**
 * Fixture data for objective states at various pipeline stages.
 */

import type { ObjectiveState } from "../../types/state.js";

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

// ---------------------------------------------------------------------------
// Requirements fixtures
// ---------------------------------------------------------------------------

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
// State fixtures at various pipeline points
// ---------------------------------------------------------------------------

export const stateAtResearch: ObjectiveState = {
  objective: "auth-refactor",
  status: "todo",
  step: "research",
  steps_completed: [],
  steps_remaining: ["scope", "plan", "build", "close"],
  group_current: null,
  groups_total: null,
  tasks_done: 0,
  tasks_total: null,
  created: "2026-03-27",
  updated: "2026-03-27T10:00:00Z",
  notes: null,
};

export const stateAtScope: ObjectiveState = {
  ...stateAtResearch,
  step: "scope",
  steps_completed: ["research"],
  steps_remaining: ["plan", "build", "close"],
  updated: "2026-03-27T11:00:00Z",
};

export const stateAtPlan: ObjectiveState = {
  ...stateAtResearch,
  step: "plan",
  steps_completed: ["research", "scope"],
  steps_remaining: ["build", "close"],
  updated: "2026-03-27T12:00:00Z",
};

export const stateAtBuild: ObjectiveState = {
  ...stateAtResearch,
  status: "in-progress",
  step: "build",
  steps_completed: ["research", "scope", "plan"],
  steps_remaining: ["close"],
  group_current: 1,
  groups_total: 3,
  tasks_done: 0,
  tasks_total: 5,
  updated: "2026-03-27T13:00:00Z",
};

export const stateAtBuildGroup2: ObjectiveState = {
  ...stateAtBuild,
  group_current: 2,
  tasks_done: 2,
  updated: "2026-03-27T14:00:00Z",
};

export const stateComplete: ObjectiveState = {
  ...stateAtResearch,
  status: "done",
  step: "close",
  steps_completed: ["research", "scope", "plan", "build", "close"],
  steps_remaining: [],
  group_current: null,
  groups_total: 3,
  tasks_done: 5,
  tasks_total: 5,
  updated: "2026-03-27T16:00:00Z",
  notes: null,
};

// Keep legacy aliases for tests that haven't been updated yet
export const stateAtDecompose = stateAtPlan;
export const stateAtExecute = stateAtBuild;
export const stateAtExecuteGroup2 = stateAtBuildGroup2;
