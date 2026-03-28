import { describe, test, expect } from "bun:test";
import { advanceState, createInitialState, nextStep } from "./machine.js";
import { defaults } from "../config/defaults.js";
import {
  stateAtResearch,
  stateAtScope,
  stateAtDecompose,
  stateAtExecute,
  stateAtExecuteGroup2,
  stateComplete,
} from "../__fixtures__/objectives.js";

const pipeline = defaults.pipeline;

describe("resume from various states", () => {
  test("resume at research — next is scope", () => {
    expect(nextStep(stateAtResearch.step, pipeline)).toBe("scope");
  });

  test("resume at scope — next is decompose (arch_review skipped)", () => {
    expect(nextStep(stateAtScope.step, pipeline)).toBe("decompose");
  });

  test("resume at decompose — next is execute", () => {
    expect(nextStep(stateAtDecompose.step, pipeline)).toBe("execute");
  });

  test("resume at execute — state has group_current and issues tracking", () => {
    expect(stateAtExecute.group_current).toBe(1);
    expect(stateAtExecute.groups_total).toBe(3);
    expect(stateAtExecute.issues_done).toBe(0);
    expect(stateAtExecute.issues_total).toBe(5);
  });

  test("resume at execute group 2 — partial progress", () => {
    expect(stateAtExecuteGroup2.group_current).toBe(2);
    expect(stateAtExecuteGroup2.issues_done).toBe(2);
  });

  test("advance from execute group 2 preserves issue count", () => {
    const advanced = advanceState(stateAtExecuteGroup2, pipeline, "built-in");
    expect(advanced.step).toBe("code_review");
    expect(advanced.issues_done).toBe(2); // preserved from input
    expect(advanced.steps_completed).toContain("execute");
  });

  test("complete state has all steps done", () => {
    expect(stateComplete.status).toBe("done");
    expect(stateComplete.steps_remaining).toEqual([]);
    expect(stateComplete.steps_completed).toContain("research");
    expect(stateComplete.steps_completed).toContain("ship");
    expect(stateComplete.issues_done).toBe(5);
    expect(stateComplete.issues_total).toBe(5);
  });

  test("cannot advance past done", () => {
    expect(nextStep("ship", pipeline)).toBeNull();
  });
});

describe("resume with full pipeline (arch_review + qa enabled)", () => {
  const fullPipeline = {
    ...pipeline,
    arch_review: { provider: "gstack:/plan-eng-review" as const, fallback: "skip" as const, options: {} },
    qa: { provider: "gstack:/qa" as const, fallback: "skip" as const, options: {} },
  };

  test("scope → arch_review (not skipped)", () => {
    expect(nextStep("scope", fullPipeline)).toBe("arch_review");
  });

  test("arch_review → decompose", () => {
    expect(nextStep("arch_review", fullPipeline)).toBe("decompose");
  });

  test("execute → code_review → qa → ship", () => {
    expect(nextStep("execute", fullPipeline)).toBe("code_review");
    expect(nextStep("code_review", fullPipeline)).toBe("qa");
    expect(nextStep("qa", fullPipeline)).toBe("ship");
  });

  test("full advance produces 8-step sequence", () => {
    let state = createInitialState("test", fullPipeline);
    const steps: string[] = [state.step];

    while (state.status !== "done") {
      state = advanceState(state, fullPipeline);
      steps.push(state.step);
    }

    // Last "step" in the loop is still "ship" when status becomes "done"
    expect(state.steps_completed).toEqual([
      "research", "scope", "arch_review", "decompose",
      "execute", "code_review", "qa", "ship",
    ]);
  });
});
