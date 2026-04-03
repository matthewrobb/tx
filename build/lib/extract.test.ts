import { describe, test, expect } from "vitest";
import { extractDeclaration, extractSignature, extractRegion, tsBlock } from "./extract.js";

describe("extractDeclaration", () => {
  test("extracts a function declaration", () => {
    const code = extractDeclaration("src/config/merge.ts", "deepMerge");
    expect(code).toContain("export function deepMerge");
    expect(code).toContain("target: T");
    expect(code).toContain("return result");
  });

  test("extracts an interface declaration", () => {
    const code = extractDeclaration("src/engine/evaluate.ts", "evaluateSteps");
    expect(code).toContain("evaluateSteps");
    expect(code).toContain("workflow");
  });

  test("extracts a const declaration", () => {
    const code = extractDeclaration("src/engine/dag.ts", "resolveDag");
    expect(code).toContain("resolveDag");
    expect(code).toContain("StepDef");
  });

  test("throws on missing declaration", () => {
    expect(() => extractDeclaration("src/config/merge.ts", "nonexistent")).toThrow(
      'Declaration "nonexistent" not found',
    );
  });
});

describe("extractSignature", () => {
  test("extracts function signature without body", () => {
    const sig = extractSignature("src/config/resolve.ts", "resolveConfig");
    expect(sig).toContain("export function resolveConfig");
    expect(sig).toContain("TwistedConfig");
    expect(sig).toContain("{ /* ... */ }");
    // Should NOT contain implementation details
    expect(sig).not.toContain("deepMerge(");
  });

  test("extracts resolveDag signature", () => {
    const sig = extractSignature("src/engine/dag.ts", "resolveDag");
    expect(sig).toContain("StepDef");
    expect(sig).toContain("DagResult");
    expect(sig).toContain("{ /* ... */ }");
  });
});

describe("tsBlock", () => {
  test("wraps code in ts fence", () => {
    const result = tsBlock("const x = 1;");
    expect(result).toBe("```ts\nconst x = 1;\n```");
  });
});
