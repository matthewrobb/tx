import { describe, test, expect } from "vitest";
import {
  getEffectiveSteps,
  nextStep,
  isStepSkipped,
  statusForStep,
  createInitialState,
  advanceState,
  stepsRemaining,
  stepsCompleted,
  PIPELINE_ORDER,
} from "../../src/state/machine.js";
import { defaults } from "../../src/config/defaults.js";

const pipeline = defaults.pipeline;

describe("PIPELINE_ORDER", () => {
  test("has 5 steps", () => {
    expect(PIPELINE_ORDER).toEqual(["research", "scope", "plan", "build", "close"]);
  });
});

describe("isStepSkipped", () => {
  test("core steps are never skipped", () => {
    expect(isStepSkipped("scope", pipeline)).toBe(false);
    expect(isStepSkipped("plan", pipeline)).toBe(false);
    expect(isStepSkipped("build", pipeline)).toBe(false);
    expect(isStepSkipped("close", pipeline)).toBe(false);
  });

  test("research with skip provider is skipped", () => {
    const skipResearch = {
      ...pipeline,
      research: { provider: "skip" as const, fallback: "skip" as const, options: {} },
    };
    expect(isStepSkipped("research", skipResearch)).toBe(true);
  });

  test("research with real provider is not skipped", () => {
    expect(isStepSkipped("research", pipeline)).toBe(false);
  });
});

describe("getEffectiveSteps", () => {
  test("default pipeline includes all 5 steps", () => {
    const steps = getEffectiveSteps(pipeline);
    expect(steps).toEqual(["research", "scope", "plan", "build", "close"]);
  });

  test("skips research when provider is skip", () => {
    const skipResearch = {
      ...pipeline,
      research: { provider: "skip" as const, fallback: "skip" as const, options: {} },
    };
    expect(getEffectiveSteps(skipResearch)).toEqual(["scope", "plan", "build", "close"]);
  });
});

describe("nextStep", () => {
  test("research → scope", () => {
    expect(nextStep("research", pipeline)).toBe("scope");
  });

  test("scope → plan", () => {
    expect(nextStep("scope", pipeline)).toBe("plan");
  });

  test("plan → build", () => {
    expect(nextStep("plan", pipeline)).toBe("build");
  });

  test("build → close", () => {
    expect(nextStep("build", pipeline)).toBe("close");
  });

  test("close → null", () => {
    expect(nextStep("close", pipeline)).toBeNull();
  });

  test("skips research when provider is skip", () => {
    const skipResearch = {
      ...pipeline,
      research: { provider: "skip" as const, fallback: "skip" as const, options: {} },
    };
    expect(getEffectiveSteps(skipResearch)).toEqual(["scope", "plan", "build", "close"]);
  });
});

describe("statusForStep", () => {
  test("early steps are todo", () => {
    expect(statusForStep("research")).toBe("todo");
    expect(statusForStep("scope")).toBe("todo");
    expect(statusForStep("plan")).toBe("todo");
  });

  test("build and close are in-progress", () => {
    expect(statusForStep("build")).toBe("in-progress");
    expect(statusForStep("close")).toBe("in-progress");
  });
});

describe("stepsRemaining / stepsCompleted", () => {
  test("at research, all others remaining", () => {
    const remaining = stepsRemaining("research", pipeline);
    expect(remaining).toEqual(["scope", "plan", "build", "close"]);
  });

  test("at build, close remaining", () => {
    const remaining = stepsRemaining("build", pipeline);
    expect(remaining).toEqual(["close"]);
  });

  test("at research, nothing completed", () => {
    expect(stepsCompleted("research", pipeline)).toEqual([]);
  });

  test("at build, research+scope+plan completed", () => {
    const completed = stepsCompleted("build", pipeline);
    expect(completed).toEqual(["research", "scope", "plan"]);
  });
});

describe("createInitialState", () => {
  test("creates state starting at first effective step", () => {
    const state = createInitialState("auth-refactor", pipeline);
    expect(state.objective).toBe("auth-refactor");
    expect(state.status).toBe("todo");
    expect(state.step).toBe("research");
    expect(state.steps_completed).toEqual([]);
    expect(state.tasks_done).toBe(0);
    expect(state.tasks_total).toBeNull();
    expect(state.notes).toBeNull();
  });
});

describe("advanceState", () => {
  test("advances from research to scope", () => {
    const initial = createInitialState("test-obj", pipeline);
    const next = advanceState(initial, pipeline, "built-in");

    expect(next.step).toBe("scope");
    expect(next.steps_completed).toEqual(["research"]);
    expect(next.status).toBe("todo");
  });

  test("status changes to in-progress at build", () => {
    let state = createInitialState("test-obj", pipeline);
    // Advance: research → scope → plan → build
    state = advanceState(state, pipeline);
    state = advanceState(state, pipeline);
    state = advanceState(state, pipeline);

    expect(state.step).toBe("build");
    expect(state.status).toBe("in-progress");
  });

  test("final step marks as done", () => {
    let state = createInitialState("test-obj", pipeline);
    // Advance through all steps
    while (state.status !== "done") {
      state = advanceState(state, pipeline);
    }

    expect(state.status).toBe("done");
    expect(state.steps_remaining).toEqual([]);
    expect(state.steps_completed).toContain("close");
  });
});
