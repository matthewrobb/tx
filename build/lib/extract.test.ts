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
    const code = extractDeclaration("src/strategies/worktree.ts", "WorktreePaths");
    expect(code).toContain("export interface WorktreePaths");
    expect(code).toContain("objective: string");
  });

  test("extracts a const declaration", () => {
    const code = extractDeclaration("src/state/machine.ts", "PIPELINE_ORDER");
    expect(code).toContain("PIPELINE_ORDER");
    expect(code).toContain("research");
    expect(code).toContain("close");
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

  test("extracts getWorktreePaths signature", () => {
    const sig = extractSignature("src/strategies/worktree.ts", "getWorktreePaths");
    expect(sig).toContain("worktreeDir: string");
    expect(sig).toContain("WorktreePaths");
    expect(sig).toContain("{ /* ... */ }");
  });
});

describe("tsBlock", () => {
  test("wraps code in ts fence", () => {
    const result = tsBlock("const x = 1;");
    expect(result).toBe("```ts\nconst x = 1;\n```");
  });
});
