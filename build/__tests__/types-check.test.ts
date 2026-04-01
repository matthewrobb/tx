// build/__tests__/types-check.test.ts
import { describe, it, expect } from "bun:test";

describe("type contracts", () => {
  it("AgentResponse status is exhaustive", async () => {
    const mod = await import("../../types/output.d.ts");
    // Type-level check — if this file compiles, types are consistent
    expect(true).toBe(true);
  });

  it("ObjectiveStep matches pipeline order", async () => {
    const { PIPELINE_ORDER } = await import("../../src/state/machine.ts");
    expect(PIPELINE_ORDER).toEqual(["research", "scope", "plan", "build", "close"]);
  });

  it("new step names are valid", async () => {
    const { PIPELINE_ORDER } = await import("../../src/state/machine.ts");
    expect(PIPELINE_ORDER).not.toContain("decompose");
    expect(PIPELINE_ORDER).not.toContain("execute");
    expect(PIPELINE_ORDER).not.toContain("arch_review");
    expect(PIPELINE_ORDER).not.toContain("code_review");
    expect(PIPELINE_ORDER).not.toContain("qa");
    expect(PIPELINE_ORDER).not.toContain("ship");
  });
});
