import { describe, test, it, expect } from "vitest";
import { resolveConfig } from "../../src/config/resolve.js";
import { deepMerge } from "../../src/config/merge.js";

describe("deepMerge", () => {
  test("merges nested objects recursively", () => {
    const result = deepMerge(
      { a: { b: 1, c: 2 }, d: 3 },
      { a: { b: 10 } },
    );
    expect(result).toEqual({ a: { b: 10, c: 2 }, d: 3 });
  });

  test("scalars replace", () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  test("arrays replace (no merging)", () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3] });
    expect(result).toEqual({ a: [3] });
  });

  test("skips undefined values", () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: undefined, b: 3 });
    expect(result).toEqual({ a: 1, b: 3 });
  });

  test("multiple sources applied in order", () => {
    const result = deepMerge({ a: 1 }, { a: 2 }, { a: 3 });
    expect(result).toEqual({ a: 3 });
  });
});

describe("resolveConfig", () => {
  it("defaults have 5-step pipeline", () => {
    const config = resolveConfig();
    expect(config.pipeline.research).toBeDefined();
    expect(config.pipeline.arch_review).toBeDefined();
    expect(config.pipeline.code_review).toBeDefined();
    expect(config.pipeline.qa).toBeDefined();
    expect(config.pipeline.ship).toBeDefined();
  });

  it("unknown presets are silently skipped", () => {
    const config = resolveConfig({ presets: ["nonexistent" as any] });
    expect(config).toBeDefined();
  });

  test("empty settings returns defaults", () => {
    const config = resolveConfig({});
    expect(config.version).toBe("3.0");
    expect(config.execution.strategy).toBe("task-tool");
  });

  test("minimal preset skips all delegatable phases", () => {
    const config = resolveConfig({ presets: ["minimal"] });
    expect(config.pipeline.research.provider).toBe("skip");
    expect(config.pipeline.arch_review.provider).toBe("skip");
    expect(config.pipeline.qa.provider).toBe("skip");
    expect(config.execution.test_requirement).toBe("deferred");
  });
});
