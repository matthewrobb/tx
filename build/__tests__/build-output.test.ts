import { describe, test, expect } from "vitest";
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
    "twisted-work",
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
});

describe("generated preset files", () => {
  test("twisted.json exists and is valid JSON", () => {
    const content = readFileSync(resolve(ROOT, "presets/twisted.json"), "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("superpowers.json sets code_review provider", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/superpowers.json"), "utf-8"));
    expect(preset.pipeline?.code_review?.provider).toBe("superpowers:requesting-code-review");
  });

  test("superpowers.json sets discipline", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/superpowers.json"), "utf-8"));
    expect(preset.execution?.discipline).toBe("superpowers:test-driven-development");
  });

  test("minimal.json skips research", () => {
    const preset = JSON.parse(readFileSync(resolve(ROOT, "presets/minimal.json"), "utf-8"));
    expect(preset.pipeline?.research?.provider).toBe("skip");
  });

  test("presets are sparse (no version field)", () => {
    for (const name of ["twisted", "superpowers", "minimal"]) {
      const preset = JSON.parse(readFileSync(resolve(ROOT, `presets/${name}.json`), "utf-8"));
      expect(preset.version).toBeUndefined();
    }
  });
});
