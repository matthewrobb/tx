/**
 * Filesystem integration tests.
 *
 * Write to .test-output/ (gitignored) and verify the actual file
 * structure matches expectations for each tracking strategy.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { existsSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { resolveConfig } from "../config/resolve.js";
import { writeResearch, writeRequirements, writeIssuesAndPlan, type WriteOptions } from "../strategies/writer.js";
import { objectiveDir } from "../strategies/paths.js";
import {
  researchFindings,
  requirementsContent,
  issues,
  issueGroups,
  dependencyGraph,
} from "../__fixtures__/objectives.js";
import * as settings from "../__fixtures__/settings.js";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, ".test-output");

function read(path: string): string {
  return readFileSync(resolve(OUT, path), "utf-8");
}

function exists(path: string): boolean {
  return existsSync(resolve(OUT, path));
}

function clean(): void {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
}

function opts(extra?: Partial<WriteOptions>): WriteOptions {
  return { projectRoot: OUT, ...extra };
}

// ---------------------------------------------------------------------------
// Twisted strategy — full pipeline
// ---------------------------------------------------------------------------

describe("twisted strategy filesystem", () => {
  const objective = "auth-refactor";
  const objDir = ".twisted/todo/auth-refactor";

  beforeEach(clean);

  test("research writes RESEARCH-*.md files", () => {
    const files = writeResearch("twisted", objective, objDir, researchFindings, opts());

    expect(files).toHaveLength(2);
    expect(exists(".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/RESEARCH-2.md")).toBe(true);

    const content = read(".twisted/todo/auth-refactor/RESEARCH-1.md");
    expect(content).toContain("objective: auth-refactor");
    expect(content).toContain("agent_number: 1");
    expect(content).toContain("focus: authentication flow");
    expect(content).toContain("## Agent 1 — authentication flow");
    expect(content).toContain("src/middleware/auth.ts");
  });

  test("requirements writes REQUIREMENTS.md", () => {
    writeRequirements("twisted", objective, objDir, requirementsContent, opts());

    const content = read(".twisted/todo/auth-refactor/REQUIREMENTS.md");
    expect(content).toContain("objective: auth-refactor");
    expect(content).toContain("complete: true");
    expect(content).toContain("## Scope");
    expect(content).toContain("Extract token validation");
    expect(content).toContain("## Acceptance");
    expect(content).toContain("Load test: 1000 concurrent");
  });

  test("decompose writes ISSUES.md + PLAN.md", () => {
    writeIssuesAndPlan("twisted", objective, objDir, issues, issueGroups, dependencyGraph, opts());

    expect(exists(".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/PLAN.md")).toBe(true);

    const issuesContent = read(".twisted/todo/auth-refactor/ISSUES.md");
    expect(issuesContent).toContain("total_issues: 5");
    expect(issuesContent).toContain("total_groups: 3");
    expect(issuesContent).toContain("[ISSUE-001] Extract token validation");
    expect(issuesContent).toContain("[ ] Done");

    const planContent = read(".twisted/todo/auth-refactor/PLAN.md");
    expect(planContent).toContain("total_agents: 4");
    expect(planContent).toContain("Group 1");
    expect(planContent).toContain("Group 2");
    expect(planContent).toContain("Group 3");
    expect(planContent).toContain("Batched: 1");
  });
});

// ---------------------------------------------------------------------------
// Nimbalyst strategy — full pipeline
// ---------------------------------------------------------------------------

describe("nimbalyst strategy filesystem", () => {
  const objective = "auth-refactor";
  const objDir = ".twisted/todo/auth-refactor";
  const nc = { default_priority: "medium" as const, default_owner: "claude" };

  beforeEach(clean);

  test("research creates nimbalyst plan doc", () => {
    writeResearch("nimbalyst", objective, objDir, researchFindings, opts({ nimbalystConfig: nc }));

    expect(exists("nimbalyst-local/plans/auth-refactor.md")).toBe(true);

    const content = read("nimbalyst-local/plans/auth-refactor.md");
    expect(content).toContain("planId: plan-auth-refactor");
    expect(content).toContain("status: draft");
    expect(content).toContain("priority: medium");
    expect(content).toContain("owner: claude");
    expect(content).toContain("## Goals");
    expect(content).toContain("## Problem Description");
  });

  test("requirements appends to plan doc and updates status", () => {
    writeResearch("nimbalyst", objective, objDir, researchFindings, opts({ nimbalystConfig: nc }));
    writeRequirements("nimbalyst", objective, objDir, requirementsContent, opts());

    const content = read("nimbalyst-local/plans/auth-refactor.md");
    expect(content).toContain("status: ready-for-development");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("## Key Components");
    expect(content).toContain("All existing auth tests pass");
  });

  test("decompose adds checklist + tracker items", () => {
    writeResearch("nimbalyst", objective, objDir, researchFindings, opts({ nimbalystConfig: nc }));
    writeRequirements("nimbalyst", objective, objDir, requirementsContent, opts());
    writeIssuesAndPlan("nimbalyst", objective, objDir, issues, issueGroups, dependencyGraph, opts({ nimbalystConfig: nc }));

    const planContent = read("nimbalyst-local/plans/auth-refactor.md");
    expect(planContent).toContain("## Implementation Progress");
    expect(planContent).toContain("- [ ] ISSUE-001: Extract token validation");
    expect(planContent).toContain("- [ ] ISSUE-005: Session cookie backward");

    expect(exists("nimbalyst-local/tracker/tasks.md")).toBe(true);
    const trackerContent = read("nimbalyst-local/tracker/tasks.md");
    expect(trackerContent).toContain("#task[id:task_");
    expect(trackerContent).toContain("#bug[id:bug_");
    expect(trackerContent).toContain("status:to-do");
    expect(trackerContent).toContain("ISSUE-004");
  });
});

// ---------------------------------------------------------------------------
// gstack strategy — full pipeline
// ---------------------------------------------------------------------------

describe("gstack strategy filesystem", () => {
  const objective = "auth-refactor";
  const objDir = ".twisted/todo/auth-refactor";

  beforeEach(clean);

  test("research creates DESIGN.md", () => {
    writeResearch("gstack", objective, objDir, researchFindings, opts());

    expect(exists(".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
    const content = read(".twisted/todo/auth-refactor/DESIGN.md");
    expect(content).toContain("status: ACTIVE");
    expect(content).toContain("## Vision");
    expect(content).toContain("## Constraints");
    expect(content).toContain("## Detailed Design");
  });

  test("requirements appends to DESIGN.md", () => {
    writeResearch("gstack", objective, objDir, researchFindings, opts());
    writeRequirements("gstack", objective, objDir, requirementsContent, opts());

    const content = read(".twisted/todo/auth-refactor/DESIGN.md");
    expect(content).toContain("## Scope");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("Extract token validation");
  });

  test("decompose writes gstack PLAN.md + twisted ISSUES.md", () => {
    writeResearch("gstack", objective, objDir, researchFindings, opts());
    writeRequirements("gstack", objective, objDir, requirementsContent, opts());
    writeIssuesAndPlan("gstack", objective, objDir, issues, issueGroups, dependencyGraph, opts());

    const planContent = read(".twisted/todo/auth-refactor/PLAN.md");
    expect(planContent).toContain("name: auth-refactor");
    expect(planContent).toContain("## Problem Statement");
    expect(planContent).toContain("## Approach");
    expect(planContent).toContain("## Implementation");
    expect(planContent).toContain("Group 1");

    expect(exists(".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    const issuesContent = read(".twisted/todo/auth-refactor/ISSUES.md");
    expect(issuesContent).toContain("ISSUE-001");
  });
});

// ---------------------------------------------------------------------------
// Multi-strategy — primary + tracking
// ---------------------------------------------------------------------------

describe("multi-strategy filesystem", () => {
  const objective = "auth-refactor";
  const objDir = ".twisted/todo/auth-refactor";

  beforeEach(clean);

  test("nimbalyst primary + twisted tracking writes both", () => {
    const config = resolveConfig(settings.nimbalystWithTwisted);

    for (const strategy of config.tracking) {
      writeResearch(strategy, objective, objDir, researchFindings, opts({ nimbalystConfig: config.nimbalyst }));
    }

    expect(exists("nimbalyst-local/plans/auth-refactor.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/RESEARCH-2.md")).toBe(true);
  });

  test("gstack primary + nimbalyst tracking writes both", () => {
    const config = resolveConfig(settings.gstackWithNimbalyst);

    for (const strategy of config.tracking) {
      writeResearch(strategy, objective, objDir, researchFindings, opts({ nimbalystConfig: config.nimbalyst }));
    }

    expect(exists(".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
    expect(exists("nimbalyst-local/plans/auth-refactor.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end pipeline
// ---------------------------------------------------------------------------

describe("end-to-end pipeline", () => {
  beforeEach(clean);

  test("full pipeline with nimbalyst+twisted tracking", () => {
    const config = resolveConfig(settings.nimbalystWithTwisted);
    const objective = "auth-refactor";
    const objDir = objectiveDir(objective, "todo", config.state, config.directories);
    const writeOpts = opts({ nimbalystConfig: config.nimbalyst });

    // 1. Research
    for (const strategy of config.tracking) {
      writeResearch(strategy, objective, objDir, researchFindings, writeOpts);
    }

    // 2. Requirements
    for (const strategy of config.tracking) {
      writeRequirements(strategy, objective, objDir, requirementsContent, writeOpts);
    }

    // 3. Decompose
    for (const strategy of config.tracking) {
      writeIssuesAndPlan(strategy, objective, objDir, issues, issueGroups, dependencyGraph, writeOpts);
    }

    // Verify nimbalyst artifacts
    const planDoc = read("nimbalyst-local/plans/auth-refactor.md");
    expect(planDoc).toContain("## Goals");
    expect(planDoc).toContain("## Acceptance Criteria");
    expect(planDoc).toContain("## Implementation Progress");
    expect(planDoc).toContain("status: ready-for-development");

    const tracker = read("nimbalyst-local/tracker/tasks.md");
    expect(tracker).toContain("#task[id:task_");

    // Verify twisted artifacts
    expect(exists(".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/REQUIREMENTS.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });
});
