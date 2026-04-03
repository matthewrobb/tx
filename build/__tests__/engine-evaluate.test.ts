// build/__tests__/engine-evaluate.test.ts
//
// Tests for the v3 artifact/predicate evaluation (engine/artifacts.ts, engine/predicates.ts).
// The v4 step evaluator (engine/evaluate.ts) is tested in src/engine/__tests__/evaluate.test.ts.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { artifactSatisfied, allArtifactsSatisfied, missingArtifacts } from "../../src/engine/artifacts.js";
import { evaluatePredicate, evaluateAllPredicates, failingPredicates } from "../../src/engine/predicates.js";
import type { PredicateContext } from "../../src/engine/predicates.js";

const TMP = join(import.meta.dirname, "../.test-output/engine-evaluate");

describe("artifactSatisfied", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("returns false when file does not exist", () => {
    expect(artifactSatisfied(TMP, { path: "research.md" })).toBe(false);
  });

  it("returns true when file exists", () => {
    writeFileSync(join(TMP, "research.md"), "content");
    expect(artifactSatisfied(TMP, { path: "research.md" })).toBe(true);
  });

  it("allArtifactsSatisfied: all present", () => {
    writeFileSync(join(TMP, "a.md"), "");
    writeFileSync(join(TMP, "b.md"), "");
    expect(allArtifactsSatisfied(TMP, [{ path: "a.md" }, { path: "b.md" }])).toBe(true);
  });

  it("allArtifactsSatisfied: one missing", () => {
    writeFileSync(join(TMP, "a.md"), "");
    expect(allArtifactsSatisfied(TMP, [{ path: "a.md" }, { path: "b.md" }])).toBe(false);
  });

  it("missingArtifacts: returns only missing", () => {
    writeFileSync(join(TMP, "a.md"), "");
    const missing = missingArtifacts(TMP, [{ path: "a.md" }, { path: "b.md" }]);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.path).toBe("b.md");
  });
});

describe("evaluatePredicate", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  const ctx = (): PredicateContext => ({ epicDir: TMP, twistedRoot: TMP });

  it("artifact.exists: false when missing", () => {
    expect(evaluatePredicate({ name: "artifact.exists", args: { path: "x.md" } }, ctx())).toBe(false);
  });

  it("artifact.exists: true when present", () => {
    writeFileSync(join(TMP, "x.md"), "");
    expect(evaluatePredicate({ name: "artifact.exists", args: { path: "x.md" } }, ctx())).toBe(true);
  });

  it("tasks.all_done: false when tasks.json missing", () => {
    expect(evaluatePredicate({ name: "tasks.all_done" }, ctx())).toBe(false);
  });

  it("tasks.all_done: false when tasks incomplete", () => {
    writeFileSync(join(TMP, "tasks.json"), JSON.stringify([{ id: "T-001", done: false }]));
    expect(evaluatePredicate({ name: "tasks.all_done" }, ctx())).toBe(false);
  });

  it("tasks.all_done: true when all done", () => {
    writeFileSync(join(TMP, "tasks.json"), JSON.stringify([{ id: "T-001", done: true }]));
    expect(evaluatePredicate({ name: "tasks.all_done" }, ctx())).toBe(true);
  });

  it("unknown predicate returns false", () => {
    expect(evaluatePredicate({ name: "unknown.predicate" }, ctx())).toBe(false);
  });

  it("failingPredicates: returns names of failing predicates", () => {
    const failing = failingPredicates(
      [{ name: "artifact.exists", args: { path: "missing.md" } }, { name: "unknown" }],
      ctx(),
    );
    expect(failing).toContain("artifact.exists");
    expect(failing).toContain("unknown");
  });
});

// NOTE: v3 evaluateSteps/activeStep/laneComplete tests removed.
// The v4 step evaluator is tested in src/engine/__tests__/evaluate.test.ts.
