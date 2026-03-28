import { describe, test, expect } from "bun:test";
import { getArtifactPaths, getAllArtifactPaths, objectiveDir } from "./paths.js";
import { defaults } from "../config/defaults.js";

describe("objectiveDir", () => {
  test("with folders enabled, todo status", () => {
    const dir = objectiveDir("auth", "todo", defaults.state, defaults.directories);
    expect(dir).toBe(".twisted/todo/auth");
  });

  test("with folders enabled, in-progress status", () => {
    const dir = objectiveDir("auth", "in-progress", defaults.state, defaults.directories);
    expect(dir).toBe(".twisted/in-progress/auth");
  });

  test("with folders disabled, flat structure", () => {
    const state = { ...defaults.state, use_folders: false };
    const dir = objectiveDir("auth", "todo", state, defaults.directories);
    expect(dir).toBe(".twisted/auth");
  });
});

describe("getArtifactPaths", () => {
  const objDir = ".twisted/todo/auth";

  test("twisted strategy paths", () => {
    const paths = getArtifactPaths("twisted", "auth", objDir);
    expect(paths.requirements).toBe(`${objDir}/REQUIREMENTS.md`);
    expect(paths.plan).toBe(`${objDir}/PLAN.md`);
    expect(paths.issues).toBe(`${objDir}/ISSUES.md`);
    expect(paths.tracker).toBeNull();
    expect(paths.design).toBeNull();

    // research is a function for twisted (multiple files)
    expect(typeof paths.research).toBe("function");
    expect((paths.research as Function)(1)).toBe(`${objDir}/RESEARCH-1.md`);
    expect((paths.research as Function)(2)).toBe(`${objDir}/RESEARCH-2.md`);
  });

  test("nimbalyst strategy paths", () => {
    const paths = getArtifactPaths("nimbalyst", "auth", objDir);
    // All research/req/plan go to same file
    expect(paths.research).toBe("nimbalyst-local/plans/auth.md");
    expect(paths.requirements).toBe("nimbalyst-local/plans/auth.md");
    expect(paths.plan).toBe("nimbalyst-local/plans/auth.md");
    expect(paths.issues).toBeNull(); // embedded in plan
    expect(paths.tracker).toBe("nimbalyst-local/tracker/tasks.md");
  });

  test("gstack strategy paths", () => {
    const paths = getArtifactPaths("gstack", "auth", objDir);
    expect(paths.research).toBe(`${objDir}/DESIGN.md`);
    expect(paths.design).toBe(`${objDir}/DESIGN.md`);
    expect(paths.plan).toBe(`${objDir}/PLAN.md`);
    expect(paths.issues).toBe(`${objDir}/ISSUES.md`); // always present for execute
  });

  test("unknown strategy falls back to twisted", () => {
    const paths = getArtifactPaths("custom-thing", "auth", objDir);
    expect(paths.plan).toBe(`${objDir}/PLAN.md`);
  });
});

describe("getAllArtifactPaths", () => {
  test("single strategy = primary only", () => {
    const { primary, additional } = getAllArtifactPaths(
      ["twisted"], "auth", ".twisted/todo/auth",
    );
    expect(primary.plan).toBe(".twisted/todo/auth/PLAN.md");
    expect(additional).toHaveLength(0);
  });

  test("multiple strategies = primary + additional", () => {
    const { primary, additional } = getAllArtifactPaths(
      ["nimbalyst", "twisted"], "auth", ".twisted/todo/auth",
    );
    expect(primary.plan).toBe("nimbalyst-local/plans/auth.md");
    expect(additional).toHaveLength(1);
    expect(additional[0]!.plan).toBe(".twisted/todo/auth/PLAN.md");
  });
});
