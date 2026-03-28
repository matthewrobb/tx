import { describe, test, expect } from "bun:test";
import { resolveConfig, getPrimaryStrategy, getActiveStrategies } from "./resolve.js";
import { deepMerge } from "./merge.js";
import { defaults } from "./defaults.js";

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
  test("empty settings returns defaults", () => {
    const config = resolveConfig({});
    expect(config.version).toBe("2.0");
    expect(config.tracking).toEqual(["twisted"]);
    expect(config.execution.strategy).toBe("task-tool");
  });

  test("preset overrides defaults", () => {
    const config = resolveConfig({ presets: ["superpowers"] });
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
    expect(config.pipeline.code_review.provider).toBe("superpowers:requesting-code-review");
  });

  test("first preset wins on conflict (cascade)", () => {
    // superpowers sets code_review to superpowers, gstack sets it to gstack
    // superpowers is first, so it should win
    const config = resolveConfig({ presets: ["superpowers", "gstack"] });
    expect(config.pipeline.code_review.provider).toBe("superpowers:requesting-code-review");
  });

  test("reversed order flips priority", () => {
    const config = resolveConfig({ presets: ["gstack", "superpowers"] });
    expect(config.pipeline.code_review.provider).toBe("gstack:/review");
    // superpowers discipline still applies (gstack doesn't set it)
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
  });

  test("project settings override presets", () => {
    const config = resolveConfig({
      presets: ["gstack"],
      execution: { strategy: "agent-teams" },
    });
    expect(config.pipeline.research.provider).toBe("gstack:/office-hours");
    expect(config.execution.strategy).toBe("agent-teams");
  });

  test("nimbalyst preset sets tracking", () => {
    const config = resolveConfig({ presets: ["nimbalyst"] });
    expect(config.tracking).toEqual(["nimbalyst"]);
  });

  test("tracking can be overridden in project settings", () => {
    const config = resolveConfig({
      presets: ["nimbalyst"],
      tracking: ["nimbalyst", "twisted"],
    });
    expect(config.tracking).toEqual(["nimbalyst", "twisted"]);
  });

  test("unknown preset names are silently skipped", () => {
    const config = resolveConfig({ presets: ["nonexistent", "superpowers"] });
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
  });

  test("minimal preset skips all delegatable phases", () => {
    const config = resolveConfig({ presets: ["minimal"] });
    expect(config.pipeline.research.provider).toBe("skip");
    expect(config.pipeline.arch_review.provider).toBe("skip");
    expect(config.pipeline.code_review.provider).toBe("skip");
    expect(config.pipeline.qa.provider).toBe("skip");
    expect(config.pipeline.ship.provider).toBe("skip");
    expect(config.execution.test_requirement).toBe("deferred");
  });

  test("three presets compose correctly", () => {
    // nimbalyst first (wins for tracking + research + code_review)
    // superpowers second (wins for discipline, code_review fallback)
    // gstack third (fills in arch_review, qa, ship)
    const config = resolveConfig({
      presets: ["nimbalyst", "superpowers", "gstack"],
    });
    expect(config.tracking).toEqual(["nimbalyst"]);
    expect(config.pipeline.research.provider).toBe("nimbalyst:deep-researcher");
    expect(config.pipeline.code_review.provider).toBe("nimbalyst:branch-reviewer");
    expect(config.execution.discipline).toBe("superpowers:test-driven-development");
    expect(config.pipeline.qa.provider).toBe("gstack:/qa");
    expect(config.pipeline.ship.provider).toBe("gstack:/ship");
  });
});

describe("getActiveStrategies / getPrimaryStrategy", () => {
  test("returns tracking array", () => {
    const config = resolveConfig({ tracking: ["nimbalyst", "twisted"] });
    expect(getActiveStrategies(config)).toEqual(["nimbalyst", "twisted"]);
    expect(getPrimaryStrategy(config)).toBe("nimbalyst");
  });

  test("defaults to twisted", () => {
    const config = resolveConfig({});
    expect(getPrimaryStrategy(config)).toBe("twisted");
  });
});
