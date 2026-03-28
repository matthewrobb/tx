import { describe, test, expect } from "bun:test";
import {
  getEffectiveSteps,
  nextStep,
  isStepSkipped,
  statusForStep,
  createInitialState,
  advanceState,
  stepsRemaining,
  stepsCompleted,
} from "./machine.js";
import { defaults } from "../config/defaults.js";

const pipeline = defaults.pipeline;

// Pipeline with arch_review and qa skipped (default config)
const defaultPipeline = pipeline;

// Pipeline with everything enabled
const fullPipeline = {
  ...pipeline,
  arch_review: { provider: "gstack:/plan-eng-review" as const, fallback: "skip" as const, options: {} },
  qa: { provider: "gstack:/qa" as const, fallback: "skip" as const, options: {} },
};

describe("isStepSkipped", () => {
  test("core steps are never skipped", () => {
    expect(isStepSkipped("scope", defaultPipeline)).toBe(false);
    expect(isStepSkipped("decompose", defaultPipeline)).toBe(false);
    expect(isStepSkipped("execute", defaultPipeline)).toBe(false);
  });

  test("delegatable steps with skip provider are skipped", () => {
    expect(isStepSkipped("arch_review", defaultPipeline)).toBe(true);
    expect(isStepSkipped("qa", defaultPipeline)).toBe(true);
  });

  test("delegatable steps with real provider are not skipped", () => {
    expect(isStepSkipped("research", defaultPipeline)).toBe(false);
    expect(isStepSkipped("code_review", defaultPipeline)).toBe(false);
    expect(isStepSkipped("ship", defaultPipeline)).toBe(false);
  });
});

describe("getEffectiveSteps", () => {
  test("default pipeline skips arch_review and qa", () => {
    const steps = getEffectiveSteps(defaultPipeline);
    expect(steps).toEqual([
      "research", "scope", "decompose", "execute", "code_review", "ship",
    ]);
    expect(steps).not.toContain("arch_review");
    expect(steps).not.toContain("qa");
  });

  test("full pipeline includes all steps", () => {
    const steps = getEffectiveSteps(fullPipeline);
    expect(steps).toEqual([
      "research", "scope", "arch_review", "decompose", "execute",
      "code_review", "qa", "ship",
    ]);
  });
});

describe("nextStep", () => {
  test("advances through default pipeline", () => {
    expect(nextStep("research", defaultPipeline)).toBe("scope");
    expect(nextStep("scope", defaultPipeline)).toBe("decompose");
    expect(nextStep("decompose", defaultPipeline)).toBe("execute");
    expect(nextStep("execute", defaultPipeline)).toBe("code_review");
    expect(nextStep("code_review", defaultPipeline)).toBe("ship");
    expect(nextStep("ship", defaultPipeline)).toBeNull();
  });

  test("skips arch_review in default pipeline", () => {
    // scope → decompose (skips arch_review)
    expect(nextStep("scope", defaultPipeline)).toBe("decompose");
  });

  test("includes arch_review in full pipeline", () => {
    expect(nextStep("scope", fullPipeline)).toBe("arch_review");
    expect(nextStep("arch_review", fullPipeline)).toBe("decompose");
  });
});

describe("statusForStep", () => {
  test("early steps are todo", () => {
    expect(statusForStep("research")).toBe("todo");
    expect(statusForStep("scope")).toBe("todo");
    expect(statusForStep("decompose")).toBe("todo");
  });

  test("execute and later are in-progress", () => {
    expect(statusForStep("execute")).toBe("in-progress");
    expect(statusForStep("code_review")).toBe("in-progress");
    expect(statusForStep("qa")).toBe("in-progress");
  });
});

describe("stepsRemaining / stepsCompleted", () => {
  test("at research, all others remaining", () => {
    const remaining = stepsRemaining("research", defaultPipeline);
    expect(remaining).toEqual(["scope", "decompose", "execute", "code_review", "ship"]);
  });

  test("at execute, review and ship remaining", () => {
    const remaining = stepsRemaining("execute", defaultPipeline);
    expect(remaining).toEqual(["code_review", "ship"]);
  });

  test("at research, nothing completed", () => {
    expect(stepsCompleted("research", defaultPipeline)).toEqual([]);
  });

  test("at execute, research+scope+decompose completed", () => {
    const completed = stepsCompleted("execute", defaultPipeline);
    expect(completed).toEqual(["research", "scope", "decompose"]);
  });
});

describe("createInitialState", () => {
  test("creates state starting at first effective step", () => {
    const state = createInitialState("auth-refactor", defaultPipeline);
    expect(state.objective).toBe("auth-refactor");
    expect(state.status).toBe("todo");
    expect(state.step).toBe("research");
    expect(state.steps_completed).toEqual([]);
    expect(state.issues_done).toBe(0);
    expect(state.issues_total).toBeNull();
  });
});

describe("advanceState", () => {
  test("advances from research to scope", () => {
    const initial = createInitialState("test-obj", defaultPipeline);
    const next = advanceState(initial, defaultPipeline, "built-in");

    expect(next.step).toBe("scope");
    expect(next.steps_completed).toEqual(["research"]);
    expect(next.tools_used.research).toBe("built-in");
    expect(next.status).toBe("todo");
  });

  test("status changes to in-progress at execute", () => {
    let state = createInitialState("test-obj", defaultPipeline);
    // Advance: research → scope → decompose → execute
    state = advanceState(state, defaultPipeline);
    state = advanceState(state, defaultPipeline);
    state = advanceState(state, defaultPipeline);

    expect(state.step).toBe("execute");
    expect(state.status).toBe("in-progress");
  });

  test("final step marks as done", () => {
    let state = createInitialState("test-obj", defaultPipeline);
    // Advance through all steps
    while (state.status !== "done") {
      state = advanceState(state, defaultPipeline);
    }

    expect(state.status).toBe("done");
    expect(state.steps_remaining).toEqual([]);
    expect(state.steps_completed).toContain("ship");
  });
});
