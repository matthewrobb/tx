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
  it("defaults have 6-lane model", () => {
    const config = resolveConfig();
    expect(config.version).toBe("4.0");
    expect(config.lanes).toHaveLength(6);
    const laneDirs = config.lanes.map((l) => l.dir);
    expect(laneDirs).toContain("0-backlog");
    expect(laneDirs).toContain("2-active");
    expect(laneDirs).toContain("4-done");
  });

  test("empty settings returns defaults", () => {
    const config = resolveConfig({});
    expect(config.version).toBe("4.0");
    expect(config.types.length).toBeGreaterThan(0);
  });

  test("project settings override defaults", () => {
    const config = resolveConfig({ context_skills: ["/my-skill"] });
    expect(config.context_skills).toContain("/my-skill");
    // Lanes still come from defaults
    expect(config.lanes.length).toBe(6);
  });

  test("nested settings merge with defaults", () => {
    const customLanes = [{ name: "backlog", dir: "0-backlog", steps: [] }];
    const config = resolveConfig({ lanes: customLanes });
    expect(config.lanes).toHaveLength(1);
    // Version still from defaults
    expect(config.version).toBe("4.0");
  });
});
