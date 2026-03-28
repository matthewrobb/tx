import { describe, test, expect } from "bun:test";
import { extractDeclaration, extractSignature, extractRegion, tsBlock } from "./extract.js";

describe("extractDeclaration", () => {
  test("extracts a function declaration", () => {
    const code = extractDeclaration("src/config/merge.ts", "deepMerge");
    expect(code).toContain("export function deepMerge");
    expect(code).toContain("target: T");
    expect(code).toContain("return result");
  });

  test("extracts an interface declaration", () => {
    const code = extractDeclaration("src/strategies/writer.ts", "ResearchAgent");
    expect(code).toContain("export interface ResearchAgent");
    expect(code).toContain("agentNumber: number");
    expect(code).toContain("findings: string");
  });

  test("extracts a const declaration", () => {
    const code = extractDeclaration("src/state/machine.ts", "PIPELINE_ORDER");
    expect(code).toContain("PIPELINE_ORDER");
    expect(code).toContain("research");
    expect(code).toContain("ship");
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
    expect(sig).toContain("TwistedSettings");
    expect(sig).toContain("TwistedConfig");
    expect(sig).toContain("{ /* ... */ }");
    // Should NOT contain implementation details
    expect(sig).not.toContain("deepMerge(");
  });

  test("extracts writeResearch signature", () => {
    const sig = extractSignature("src/strategies/writer.ts", "writeResearch");
    expect(sig).toContain("strategy: TrackingStrategy");
    expect(sig).toContain("agents: ResearchAgent[]");
    expect(sig).toContain("string[]");
  });
});

describe("tsBlock", () => {
  test("wraps code in typescript fence", () => {
    const result = tsBlock("const x = 1;");
    expect(result).toBe("```typescript\nconst x = 1;\n```");
  });
});
