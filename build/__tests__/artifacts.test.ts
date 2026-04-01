// build/__tests__/artifacts.test.ts
import { describe, it, expect } from "vitest";
import { resolveArtifactPath, listArtifacts } from "../../src/artifacts/artifacts.ts";

describe("artifact paths", () => {
  const objDir = ".twisted/todo/my-feature";

  it("resolves scope path", () => {
    expect(resolveArtifactPath(objDir, "scope")).toBe(".twisted/todo/my-feature/scope.md");
  });

  it("resolves plan path", () => {
    expect(resolveArtifactPath(objDir, "plan")).toBe(".twisted/todo/my-feature/plan.md");
  });

  it("resolves research path with number", () => {
    expect(resolveArtifactPath(objDir, "research", 3)).toBe(".twisted/todo/my-feature/research/003.md");
  });

  it("resolves research path without number defaults to next", () => {
    // Without filesystem, defaults to 001
    expect(resolveArtifactPath(objDir, "research")).toBe(".twisted/todo/my-feature/research/001.md");
  });

  it("resolves changelog path", () => {
    expect(resolveArtifactPath(objDir, "changelog")).toBe("CHANGELOG.md");
  });
});
