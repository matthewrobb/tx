/**
 * Filesystem integration tests.
 *
 * Each scenario writes to its own subdirectory of .test-output/ so output
 * is reviewable after tests run. NOT cleaned between tests.
 *
 * Run `rm -rf .test-output` to reset, then `bun test` to regenerate.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { existsSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { resolveConfig } from "../../src/config/resolve.js";
import { writeResearch, writeRequirements, writeIssuesAndPlan, type WriteOptions } from "../../src/strategies/writer.js";
import { objectiveDir } from "../../src/strategies/paths.js";
import {
  researchFindings,
  requirementsContent,
  issues,
  issueGroups,
  dependencyGraph,
} from "../../src/__fixtures__/objectives.js";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, ".test-output");

function read(scenario: string, path: string): string {
  return readFileSync(resolve(OUT, scenario, path), "utf-8");
}

function exists(scenario: string, path: string): boolean {
  return existsSync(resolve(OUT, scenario, path));
}

function scenarioOpts(scenario: string, extra?: Partial<WriteOptions>): WriteOptions {
  return { projectRoot: resolve(OUT, scenario), ...extra };
}

/** Run the full research → requirements → decompose pipeline for a scenario. */
function runFullPipeline(
  scenario: string,
  settingsInput: Parameters<typeof resolveConfig>[0],
) {
  const config = resolveConfig(settingsInput);
  const objective = "auth-refactor";
  const objDir = objectiveDir(objective, "todo", config.state, config.directories);
  const opts = scenarioOpts(scenario, { nimbalystConfig: config.nimbalyst });

  for (const strategy of config.tracking) {
    writeResearch(strategy, objective, objDir, researchFindings, opts);
  }
  for (const strategy of config.tracking) {
    writeRequirements(strategy, objective, objDir, requirementsContent, opts);
  }
  for (const strategy of config.tracking) {
    writeIssuesAndPlan(strategy, objective, objDir, issues, issueGroups, dependencyGraph, opts);
  }

  return { config, objective, objDir };
}

// Clean once before all tests
beforeAll(() => {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
});

// ---------------------------------------------------------------------------
// 1. Pure defaults (empty presets)
// ---------------------------------------------------------------------------

describe("scenario: defaults", () => {
  const S = "01-defaults";
  beforeAll(() => runFullPipeline(S, {}));

  test("uses twisted strategy", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-2.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/REQUIREMENTS.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });

  test("no nimbalyst or gstack artifacts", () => {
    expect(exists(S, "nimbalyst-local")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(false);
  });

  test("ISSUES.md has correct structure", () => {
    const content = read(S, ".twisted/todo/auth-refactor/ISSUES.md");
    expect(content).toContain("total_issues: 5");
    expect(content).toContain("total_groups: 3");
    expect(content).toContain("[ISSUE-001]");
    expect(content).toContain("[ISSUE-005]");
    expect(content).toContain("**Complexity**: 3 (standard)");
    expect(content).toContain("**Complexity**: 2 (batch)");
  });

  test("PLAN.md has execution order and agent summary", () => {
    const content = read(S, ".twisted/todo/auth-refactor/PLAN.md");
    expect(content).toContain("total_agents: 4");
    expect(content).toContain("Batched: 1");
    expect(content).toContain("Standard: 3");
    expect(content).toContain("Group 1");
    expect(content).toContain("Group 2");
    expect(content).toContain("(after Group 1)");
  });
});

// ---------------------------------------------------------------------------
// 2. Explicit twisted preset
// ---------------------------------------------------------------------------

describe("scenario: twisted preset", () => {
  const S = "02-twisted";
  beforeAll(() => runFullPipeline(S, { presets: ["twisted"] }));

  test("identical to defaults", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Superpowers only
// ---------------------------------------------------------------------------

describe("scenario: superpowers", () => {
  const S = "03-superpowers";
  beforeAll(() => runFullPipeline(S, { presets: ["superpowers"] }));

  test("still uses twisted tracking (superpowers doesn't set tracking)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
    expect(exists(S, "nimbalyst-local")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. gstack only
// ---------------------------------------------------------------------------

describe("scenario: gstack", () => {
  const S = "04-gstack";
  beforeAll(() => runFullPipeline(S, { presets: ["gstack"] }));

  test("uses gstack tracking strategy", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
  });

  test("no nimbalyst or twisted research files", () => {
    expect(exists(S, "nimbalyst-local")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/REQUIREMENTS.md")).toBe(false);
  });

  test("DESIGN.md has gstack format", () => {
    const content = read(S, ".twisted/todo/auth-refactor/DESIGN.md");
    expect(content).toContain("status: ACTIVE");
    expect(content).toContain("## Vision");
    expect(content).toContain("## Constraints");
    expect(content).toContain("## Alternatives Explored");
    expect(content).toContain("## Detailed Design");
    expect(content).toContain("## Scope");
    expect(content).toContain("## Acceptance Criteria");
  });

  test("PLAN.md has gstack plan format", () => {
    const content = read(S, ".twisted/todo/auth-refactor/PLAN.md");
    expect(content).toContain("name: auth-refactor");
    expect(content).toContain("version: 1.0.0");
    expect(content).toContain("## Problem Statement");
    expect(content).toContain("## Approach");
    expect(content).toContain("## Scope");
    expect(content).toContain("## Architecture");
    expect(content).toContain("## Implementation");
    expect(content).toContain("## Risks & Mitigations");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("Group 1");
  });

  test("ISSUES.md present for execute (always written)", () => {
    const content = read(S, ".twisted/todo/auth-refactor/ISSUES.md");
    expect(content).toContain("total_issues: 5");
    expect(content).toContain("ISSUE-001");
  });
});

// ---------------------------------------------------------------------------
// 5. Nimbalyst only
// ---------------------------------------------------------------------------

describe("scenario: nimbalyst", () => {
  const S = "05-nimbalyst";
  beforeAll(() => runFullPipeline(S, { presets: ["nimbalyst"] }));

  test("uses nimbalyst tracking strategy", () => {
    expect(exists(S, "nimbalyst-local/plans/auth-refactor.md")).toBe(true);
    expect(exists(S, "nimbalyst-local/tracker/tasks.md")).toBe(true);
  });

  test("no twisted or gstack artifacts", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(false);
  });

  test("plan doc has full lifecycle", () => {
    const content = read(S, "nimbalyst-local/plans/auth-refactor.md");
    // Research phase
    expect(content).toContain("planId: plan-auth-refactor");
    expect(content).toContain("## Goals");
    expect(content).toContain("## Problem Description");
    // Requirements phase (appended, status updated)
    expect(content).toContain("status: ready-for-development");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("## Key Components");
    // Decompose phase (checklist appended)
    expect(content).toContain("## Implementation Progress");
    expect(content).toContain("- [ ] ISSUE-001: Extract token validation");
    expect(content).toContain("- [ ] ISSUE-005: Session cookie backward");
  });

  test("plan doc frontmatter has all nimbalyst fields", () => {
    const content = read(S, "nimbalyst-local/plans/auth-refactor.md");
    expect(content).toContain("planId: plan-auth-refactor");
    expect(content).toContain("priority: medium");
    expect(content).toContain("owner: claude");
    expect(content).toContain("progress: 0");
    expect(content).toContain("stakeholders: []");
    expect(content).toContain("tags: []");
  });

  test("tracker has correct tag format", () => {
    const content = read(S, "nimbalyst-local/tracker/tasks.md");
    // task items
    expect(content).toContain("[ISSUE-001] Extract token validation module #task[id:task_");
    expect(content).toContain("status:to-do");
    expect(content).toContain("priority:medium");
    // bug item (ISSUE-004 is type: "bug")
    expect(content).toContain("[ISSUE-004] Update error responses #bug[id:bug_");
  });
});

// ---------------------------------------------------------------------------
// 6. Minimal
// ---------------------------------------------------------------------------

describe("scenario: minimal", () => {
  const S = "06-minimal";
  beforeAll(() => runFullPipeline(S, { presets: ["minimal"] }));

  test("uses twisted tracking (minimal doesn't set tracking)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. superpowers + gstack (superpowers first)
// ---------------------------------------------------------------------------

describe("scenario: superpowers+gstack", () => {
  const S = "07-superpowers-gstack";
  beforeAll(() => runFullPipeline(S, { presets: ["superpowers", "gstack"] }));

  test("gstack wins for tracking (superpowers doesn't set it)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. gstack + superpowers (gstack first)
// ---------------------------------------------------------------------------

describe("scenario: gstack+superpowers", () => {
  const S = "08-gstack-superpowers";
  beforeAll(() => runFullPipeline(S, { presets: ["gstack", "superpowers"] }));

  test("gstack wins for tracking (it's first and sets it)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
  });

  test("config merges both presets", () => {
    const config = resolveConfig({ presets: ["gstack", "superpowers"] });
    // gstack wins for code_review (it's first)
    expect(config.pipeline.code_review.provider).toBe("gstack:/review");
    // superpowers discipline still applies
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
  });
});

// ---------------------------------------------------------------------------
// 9. Full stack: nimbalyst + superpowers + gstack
// ---------------------------------------------------------------------------

describe("scenario: full-stack", () => {
  const S = "09-full-stack";
  beforeAll(() => runFullPipeline(S, {
    presets: ["nimbalyst", "superpowers", "gstack"],
  }));

  test("nimbalyst wins for tracking (it's first)", () => {
    expect(exists(S, "nimbalyst-local/plans/auth-refactor.md")).toBe(true);
    expect(exists(S, "nimbalyst-local/tracker/tasks.md")).toBe(true);
  });

  test("no twisted or gstack artifacts (nimbalyst is sole tracking)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(false);
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(false);
  });

  test("config composes all three presets", () => {
    const config = resolveConfig({ presets: ["nimbalyst", "superpowers", "gstack"] });
    expect(config.tracking).toEqual(["nimbalyst"]);
    expect(config.pipeline.research.provider).toBe("nimbalyst:deep-researcher");
    expect(config.pipeline.code_review.provider).toBe("nimbalyst:branch-reviewer");
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
    expect(config.pipeline.qa.provider).toBe("gstack:/qa");
    expect(config.pipeline.ship.provider).toBe("gstack:/ship");
  });
});

// ---------------------------------------------------------------------------
// 10. Nimbalyst + twisted tracking override
// ---------------------------------------------------------------------------

describe("scenario: nimbalyst+twisted tracking", () => {
  const S = "10-nimbalyst-twisted-tracking";
  beforeAll(() => runFullPipeline(S, {
    presets: ["nimbalyst", "superpowers"],
    tracking: ["nimbalyst", "twisted"],
  }));

  test("nimbalyst artifacts present (primary)", () => {
    expect(exists(S, "nimbalyst-local/plans/auth-refactor.md")).toBe(true);
    expect(exists(S, "nimbalyst-local/tracker/tasks.md")).toBe(true);
  });

  test("twisted artifacts also present (additional)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-1.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/RESEARCH-2.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/REQUIREMENTS.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });

  test("both formats have consistent issue data", () => {
    const nimPlan = read(S, "nimbalyst-local/plans/auth-refactor.md");
    const twIssues = read(S, ".twisted/todo/auth-refactor/ISSUES.md");

    // Both should reference all 5 issues
    expect(nimPlan).toContain("ISSUE-001");
    expect(nimPlan).toContain("ISSUE-005");
    expect(twIssues).toContain("ISSUE-001");
    expect(twIssues).toContain("ISSUE-005");
    expect(twIssues).toContain("total_issues: 5");
  });
});

// ---------------------------------------------------------------------------
// 11. gstack + nimbalyst tracking override
// ---------------------------------------------------------------------------

describe("scenario: gstack+nimbalyst tracking", () => {
  const S = "11-gstack-nimbalyst-tracking";
  beforeAll(() => runFullPipeline(S, {
    presets: ["gstack"],
    tracking: ["gstack", "nimbalyst"],
  }));

  test("gstack artifacts present (primary)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/DESIGN.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
  });

  test("nimbalyst artifacts also present (additional)", () => {
    expect(exists(S, "nimbalyst-local/plans/auth-refactor.md")).toBe(true);
    expect(exists(S, "nimbalyst-local/tracker/tasks.md")).toBe(true);
  });

  test("gstack PLAN.md is in gstack format (not twisted)", () => {
    const content = read(S, ".twisted/todo/auth-refactor/PLAN.md");
    expect(content).toContain("## Problem Statement");
    expect(content).toContain("## Implementation");
    // Should NOT have twisted-style dependency graph
    expect(content).not.toContain("## Dependency Graph");
  });
});

// ---------------------------------------------------------------------------
// 12. Custom overrides
// ---------------------------------------------------------------------------

describe("scenario: custom overrides", () => {
  const S = "12-custom";
  beforeAll(() => runFullPipeline(S, {
    presets: ["superpowers", "gstack"],
    tracking: ["twisted", "nimbalyst"],
    execution: { strategy: "agent-teams", worktree_tiers: 3 },
    flow: { auto_advance: false },
    decompose: {
      categories: ["scope", "behavior", "constraints", "acceptance", "performance"],
    },
  }));

  test("twisted is primary (first in tracking)", () => {
    expect(exists(S, ".twisted/todo/auth-refactor/ISSUES.md")).toBe(true);
    expect(exists(S, ".twisted/todo/auth-refactor/PLAN.md")).toBe(true);
  });

  test("nimbalyst is additional", () => {
    expect(exists(S, "nimbalyst-local/plans/auth-refactor.md")).toBe(true);
  });

  test("config overrides applied", () => {
    const config = resolveConfig({
      presets: ["superpowers", "gstack"],
      tracking: ["twisted", "nimbalyst"],
      execution: { strategy: "agent-teams", worktree_tiers: 3 },
      flow: { auto_advance: false },
    });
    expect(config.execution.strategy).toBe("agent-teams");
    expect(config.execution.worktree_tiers).toBe(3);
    expect(config.flow.auto_advance).toBe(false);
    // superpowers wins for code_review (first preset)
    expect(config.pipeline.code_review.provider).toBe("superpowers:requesting-code-review");
    // gstack fills in the rest
    expect(config.pipeline.ship.provider).toBe("gstack:/ship");
  });
});
