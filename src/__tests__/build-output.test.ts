import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * Build output validation.
 * These tests verify the committed generated files match expectations.
 * Run `bun run build` before these tests if files are out of date.
 */

describe("generated skill files", () => {
  const skills = [
    "using-twisted-workflow",
    "twisted-work",
    "twisted-scope",
    "twisted-decompose",
    "twisted-execute",
  ];

  for (const skill of skills) {
    test(`skills/${skill}/SKILL.md exists`, () => {
      expect(existsSync(resolve(ROOT, `skills/${skill}/SKILL.md`))).toBe(true);
    });

    test(`skills/${skill}/SKILL.md has valid frontmatter`, () => {
      const content = readFileSync(resolve(ROOT, `skills/${skill}/SKILL.md`), "utf-8");
      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toContain("name: ");
      expect(content).toContain("description: ");
      // Frontmatter closes
      const secondDash = content.indexOf("---", 4);
      expect(secondDash).toBeGreaterThan(0);
    });
  }

  test("twisted-work is user-invocable", () => {
    const content = readFileSync(resolve(ROOT, "skills/twisted-work/SKILL.md"), "utf-8");
    expect(content).toContain("user-invocable: true");
    expect(content).toContain("argument-hint:");
  });

  test("internal skills are not user-invocable", () => {
    for (const skill of ["twisted-scope", "twisted-decompose", "twisted-execute"]) {
      const content = readFileSync(resolve(ROOT, `skills/${skill}/SKILL.md`), "utf-8");
      expect(content).not.toContain("user-invocable: true");
    }
  });
});

describe("generated preset files", () => {
  const presets = ["twisted", "superpowers", "gstack", "nimbalyst", "minimal"];

  for (const preset of presets) {
    test(`presets/${preset}.json exists and is valid JSON`, () => {
      const path = resolve(ROOT, `presets/${preset}.json`);
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  }

  test("standalone.json does not exist (replaced by twisted)", () => {
    expect(existsSync(resolve(ROOT, "presets/standalone.json"))).toBe(false);
  });

  test("twisted preset sets tracking", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/twisted.json"), "utf-8"));
    expect(preset.tracking).toEqual(["twisted"]);
  });

  test("nimbalyst preset sets tracking + pipeline", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/nimbalyst.json"), "utf-8"));
    expect(preset.tracking).toEqual(["nimbalyst"]);
    expect(preset.pipeline.research.provider).toBe("nimbalyst:deep-researcher");
  });

  test("gstack preset sets tracking + full pipeline", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/gstack.json"), "utf-8"));
    expect(preset.tracking).toEqual(["gstack"]);
    expect(preset.pipeline.research.provider).toBe("gstack:/office-hours");
    expect(preset.pipeline.ship.provider).toBe("gstack:/ship");
  });

  test("minimal preset skips everything", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/minimal.json"), "utf-8"));
    expect(preset.pipeline.research.provider).toBe("skip");
    expect(preset.pipeline.code_review.provider).toBe("skip");
    expect(preset.execution.test_requirement).toBe("deferred");
  });

  test("superpowers preset sets discipline + code_review", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/superpowers.json"), "utf-8"));
    expect(preset.execution.discipline).toBe("superpowers:test-driven-development");
    expect(preset.pipeline.code_review.provider).toBe("superpowers:requesting-code-review");
  });

  test("presets are sparse (no version, no presets field)", () => {
    for (const name of presets) {
      const preset = JSON.parse(readFileSync(resolve(ROOT, `presets/${name}.json`), "utf-8"));
      expect(preset.version).toBeUndefined();
      expect(preset.presets).toBeUndefined();
    }
  });
});
