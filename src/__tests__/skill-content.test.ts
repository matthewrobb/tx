/**
 * Skill content tests — verify generated SKILL.md files contain
 * correct references to the functional core.
 *
 * These tests ensure the skills embed/reference the actual TypeScript
 * logic rather than prose that could drift from the implementation.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { defaults } from "../config/defaults.js";
import { PIPELINE_ORDER, CORE_STEPS, DELEGATABLE_STEPS } from "../state/machine.js";
import { allPresets } from "../presets/index.js";

const ROOT = resolve(import.meta.dirname, "../..");

function readSkill(name: string): string {
  return readFileSync(resolve(ROOT, `skills/${name}/SKILL.md`), "utf-8");
}

// ===========================================================================
// using-twisted-workflow — shared config
// ===========================================================================

describe("using-twisted-workflow content", () => {
  const skill = () => readSkill("using-twisted-workflow");

  // --- Defaults ---

  test("references tracking config with correct default", () => {
    expect(skill()).toContain('tracking: ["twisted"]');
  });

  test("contains all pipeline phases from PIPELINE_ORDER", () => {
    const content = skill();
    for (const step of PIPELINE_ORDER) {
      expect(content).toContain(step);
    }
  });

  test("contains all preset names", () => {
    const content = skill();
    for (const name of Object.keys(allPresets)) {
      expect(content).toContain(name);
    }
  });

  test("does not reference standalone preset", () => {
    expect(skill()).not.toContain("standalone");
  });

  // --- Tracking strategies ---

  test("documents all three tracking strategies", () => {
    const content = skill();
    expect(content).toContain("twisted");
    expect(content).toContain("nimbalyst");
    expect(content).toContain("gstack");
  });

  test("twisted strategy references RESEARCH-*.md, REQUIREMENTS.md, ISSUES.md, PLAN.md", () => {
    const content = skill();
    expect(content).toContain("RESEARCH-");
    expect(content).toContain("REQUIREMENTS.md");
    expect(content).toContain("ISSUES.md");
    expect(content).toContain("PLAN.md");
  });

  test("nimbalyst strategy references nimbalyst-local/plans/ and nimbalyst-local/tracker/", () => {
    const content = skill();
    expect(content).toContain("nimbalyst-local/plans/");
    expect(content).toContain("nimbalyst-local/tracker/");
  });

  test("gstack strategy references DESIGN.md", () => {
    const content = skill();
    expect(content).toContain("DESIGN.md");
  });

  // --- Config resolution ---

  test("describes 3-layer resolution with first-wins cascade", () => {
    const content = skill();
    expect(content).toContain("first");
    expect(content).toContain("deepMerge");
  });

  // --- String templates ---

  test("contains all commit message templates", () => {
    const content = skill();
    for (const [key, value] of Object.entries(defaults.strings.commit_messages)) {
      expect(content).toContain(value);
    }
  });

  test("contains all handoff message templates", () => {
    const content = skill();
    for (const [key, value] of Object.entries(defaults.strings.handoff_messages)) {
      expect(content).toContain(value);
    }
  });

  // --- Embedded code ---

  test("embeds resolveConfig logic or references src/config/", () => {
    const content = skill();
    expect(
      content.includes("resolveConfig") ||
      content.includes("src/config/") ||
      content.includes("deepMerge(defaults")
    ).toBe(true);
  });

  test("embeds state machine logic or references src/state/", () => {
    const content = skill();
    expect(
      content.includes("advanceState") ||
      content.includes("nextStep") ||
      content.includes("src/state/")
    ).toBe(true);
  });

  test("embeds tracking strategy paths or references src/strategies/", () => {
    const content = skill();
    expect(
      content.includes("getArtifactPaths") ||
      content.includes("src/strategies/") ||
      content.includes("tracking[0]")
    ).toBe(true);
  });
});

// ===========================================================================
// twisted-work — router
// ===========================================================================

describe("twisted-work content", () => {
  const skill = () => readSkill("twisted-work");

  test("is user-invocable", () => {
    expect(skill()).toContain("user-invocable: true");
  });

  test("documents all subcommands", () => {
    const content = skill();
    const subcommands = ["init", "status", "next", "resume", "scope", "decompose", "execute", "review", "ship", "config"];
    for (const cmd of subcommands) {
      expect(content).toContain(cmd);
    }
  });

  test("documents --yolo flag", () => {
    expect(skill()).toContain("--yolo");
  });

  test("references config resolution", () => {
    const content = skill();
    expect(
      content.includes("resolveConfig") ||
      content.includes("Three-Layer") ||
      content.includes("deepMerge")
    ).toBe(true);
  });

  test("references pause logic with shouldPause or equivalent", () => {
    const content = skill();
    expect(
      content.includes("shouldPause") ||
      content.includes("pause_on_config_change") ||
      content.includes("Auto-Advance")
    ).toBe(true);
  });

  test("init flow references tool detection", () => {
    const content = skill();
    expect(content).toContain("Tool Detection");
    expect(content).toContain("$schema");
  });

  test("config subcommand lists all ConfigSection values", () => {
    const content = skill();
    const sections = ["tools", "pipeline", "execution", "phases", "decompose", "templates", "writing", "state", "flow"];
    for (const section of sections) {
      expect(content).toContain(section);
    }
  });

  test("references tracking config", () => {
    expect(skill()).toContain("tracking");
  });
});

// ===========================================================================
// twisted-scope — research + requirements
// ===========================================================================

describe("twisted-scope content", () => {
  const skill = () => readSkill("twisted-scope");

  test("is not user-invocable", () => {
    expect(skill()).not.toContain("user-invocable: true");
  });

  test("handles research step with strategy-aware output", () => {
    const content = skill();
    expect(content).toContain("research");
    // Should reference tracking strategy for output format
    expect(
      content.includes("tracking") ||
      content.includes("strategy") ||
      content.includes("writeResearch")
    ).toBe(true);
  });

  test("research: twisted strategy writes RESEARCH-*.md", () => {
    const content = skill();
    expect(content).toContain("RESEARCH-");
  });

  test("research: nimbalyst strategy writes to nimbalyst-local/plans/", () => {
    const content = skill();
    expect(content).toContain("nimbalyst-local/plans/");
  });

  test("research: gstack strategy writes DESIGN.md", () => {
    const content = skill();
    expect(content).toContain("DESIGN.md");
  });

  test("handles scope step with interrogation", () => {
    const content = skill();
    expect(content).toContain("interrogat");
    expect(content).toContain("categor");
  });

  test("references default interrogation categories", () => {
    const content = skill();
    for (const cat of defaults.decompose.categories) {
      expect(content).toContain(cat);
    }
  });

  test("scope: requirements output is strategy-aware", () => {
    const content = skill();
    expect(content).toContain("REQUIREMENTS.md");
    // Should mention nimbalyst and gstack requirements output too
    expect(
      content.includes("nimbalyst") &&
      content.includes("gstack")
    ).toBe(true);
  });

  test("references state update after research and scope", () => {
    const content = skill();
    expect(
      content.includes("state.md") ||
      content.includes("advanceState") ||
      content.includes("updateState") ||
      content.includes("steps_completed")
    ).toBe(true);
  });

  test("references handoff messages", () => {
    const content = skill();
    expect(
      content.includes("research_to_scope") ||
      content.includes("scope_to_decompose") ||
      content.includes("handoff")
    ).toBe(true);
  });
});

// ===========================================================================
// twisted-decompose — issue breakdown
// ===========================================================================

describe("twisted-decompose content", () => {
  const skill = () => readSkill("twisted-decompose");

  test("is not user-invocable", () => {
    expect(skill()).not.toContain("user-invocable: true");
  });

  test("reads from primary strategy locations", () => {
    const content = skill();
    // Should reference reading research + requirements per strategy
    expect(
      content.includes("tracking") ||
      content.includes("strategy") ||
      content.includes("primary")
    ).toBe(true);
  });

  test("documents complexity estimation", () => {
    const content = skill();
    expect(content).toContain("fibonacci");
    expect(content).toContain("batch");
    expect(content).toContain("split");
  });

  test("references batch_threshold and split_threshold", () => {
    const content = skill();
    expect(content).toContain("batch_threshold");
    expect(content).toContain("split_threshold");
  });

  test("documents agent assignment based on complexity", () => {
    const content = skill();
    expect(content).toContain("batch");
    expect(content).toContain("standard");
    expect(content).toContain("split");
  });

  test("output is strategy-aware for all three strategies", () => {
    const content = skill();
    // twisted output
    expect(content).toContain("ISSUES.md");
    expect(content).toContain("PLAN.md");
    // nimbalyst output
    expect(content).toContain("nimbalyst");
    // gstack output
    expect(content).toContain("gstack");
  });

  test("references execution order computation", () => {
    const content = skill();
    expect(
      content.includes("execution_order") ||
      content.includes("computeExecutionOrder") ||
      content.includes("dependency")
    ).toBe(true);
  });

  test("references plan mode", () => {
    const content = skill();
    expect(content).toContain("plan");
    expect(content).toContain("mode");
  });

  test("references handoff message", () => {
    const content = skill();
    expect(
      content.includes("decompose_to_execute") ||
      content.includes("handoff")
    ).toBe(true);
  });
});

// ===========================================================================
// twisted-execute — parallel execution
// ===========================================================================

describe("twisted-execute content", () => {
  const skill = () => readSkill("twisted-execute");

  test("is not user-invocable", () => {
    expect(skill()).not.toContain("user-invocable: true");
  });

  test("reads from primary strategy", () => {
    const content = skill();
    expect(
      content.includes("tracking") ||
      content.includes("strategy") ||
      content.includes("primary")
    ).toBe(true);
  });

  test("documents worktree tiers", () => {
    const content = skill();
    expect(content).toContain("worktree_tiers");
    expect(content).toContain("1");
    expect(content).toContain("2");
    expect(content).toContain("3");
  });

  test("documents execution strategies", () => {
    const content = skill();
    expect(content).toContain("task-tool");
    expect(content).toContain("agent-teams");
    expect(content).toContain("manual");
  });

  test("documents merge strategies", () => {
    const content = skill();
    expect(content).toContain("merge_strategy");
    expect(content).toContain("normal");
    expect(content).toContain("squash");
    expect(content).toContain("rebase");
  });

  test("documents test requirement", () => {
    const content = skill();
    expect(content).toContain("test_requirement");
    expect(content).toContain("must-pass");
    expect(content).toContain("best-effort");
    expect(content).toContain("deferred");
  });

  test("documents review frequency", () => {
    const content = skill();
    expect(content).toContain("review_frequency");
    expect(content).toContain("per-group");
    expect(content).toContain("after-all");
  });

  test("updates all tracking formats on completion", () => {
    const content = skill();
    expect(
      content.includes("tracking") ||
      content.includes("all active") ||
      content.includes("writeAllStrategies")
    ).toBe(true);
  });

  test("handles code_review/qa/ship delegation", () => {
    const content = skill();
    expect(content).toContain("code_review");
    expect(content).toContain("qa");
    expect(content).toContain("ship");
    expect(content).toContain("provider");
  });

  test("references lane move on execute start", () => {
    const content = skill();
    expect(
      content.includes("todo") &&
      content.includes("in-progress")
    ).toBe(true);
  });

  test("references group-by-group execution with continue/stop", () => {
    const content = skill();
    expect(content).toContain("group");
    expect(
      content.includes("--yolo") ||
      content.includes("continue")
    ).toBe(true);
  });
});
