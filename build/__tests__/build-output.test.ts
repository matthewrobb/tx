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
    "tx",
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

  test("tx is user-invocable", () => {
    const content = readFileSync(resolve(ROOT, "skills/tx/SKILL.md"), "utf-8");
    expect(content).toContain("user-invocable: true");
    expect(content).toContain("argument-hint:");
  });
});
