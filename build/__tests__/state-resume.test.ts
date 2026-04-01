import { describe, test, expect } from "vitest";
import { advanceState, createInitialState, nextStep } from "../../src/state/machine.js";
import { defaults } from "../../src/config/defaults.js";
import {
  stateAtResearch,
  stateAtScope,
  stateAtPlan,
  stateAtBuild,
  stateAtBuildGroup2,
  stateComplete,
} from "../__fixtures__/objectives.js";

const pipeline = defaults.pipeline;

describe("resume from various states", () => {
  test("resume at research — next is scope", () => {
    expect(nextStep(stateAtResearch.step, pipeline)).toBe("scope");
  });

  test("resume at scope — next is plan (arch_review skipped)", () => {
    expect(nextStep(stateAtScope.step, pipeline)).toBe("plan");
  });

  test("resume at plan — next is build", () => {
    expect(nextStep(stateAtPlan.step, pipeline)).toBe("build");
  });

  test("resume at build — state has group_current and tasks tracking", () => {
    expect(stateAtBuild.group_current).toBe(1);
    expect(stateAtBuild.groups_total).toBe(3);
    expect(stateAtBuild.tasks_done).toBe(0);
    expect(stateAtBuild.tasks_total).toBe(5);
  });

  test("resume at build group 2 — partial progress", () => {
    expect(stateAtBuildGroup2.group_current).toBe(2);
    expect(stateAtBuildGroup2.tasks_done).toBe(2);
  });

  test("advance from build group 2 preserves task count", () => {
    const advanced = advanceState(stateAtBuildGroup2, pipeline, "built-in");
    expect(advanced.step).toBe("close");
    expect(advanced.tasks_done).toBe(2); // preserved from input
    expect(advanced.steps_completed).toContain("build");
  });

  test("complete state has all steps done", () => {
    expect(stateComplete.status).toBe("done");
    expect(stateComplete.steps_remaining).toEqual([]);
    expect(stateComplete.steps_completed).toContain("research");
    expect(stateComplete.steps_completed).toContain("close");
    expect(stateComplete.tasks_done).toBe(5);
    expect(stateComplete.tasks_total).toBe(5);
  });

  test("cannot advance past close", () => {
    expect(nextStep("close", pipeline)).toBeNull();
  });
});

describe("resume with research skipped (minimal pipeline)", () => {
  const minimalPipeline = {
    ...pipeline,
    research: { provider: "skip" as const, fallback: "skip" as const, options: {} },
  };

  test("scope → plan (research skipped)", () => {
    expect(nextStep("scope", minimalPipeline)).toBe("plan");
  });

  test("plan → build", () => {
    expect(nextStep("plan", minimalPipeline)).toBe("build");
  });

  test("build → close", () => {
    expect(nextStep("build", minimalPipeline)).toBe("close");
  });

  test("full advance produces 4-step sequence when research skipped", () => {
    let state = createInitialState("test", minimalPipeline);
    const steps: string[] = [state.step];

    while (state.status !== "done") {
      state = advanceState(state, minimalPipeline);
      steps.push(state.step);
    }

    expect(state.steps_completed).toEqual(["scope", "plan", "build", "close"]);
  });
});
