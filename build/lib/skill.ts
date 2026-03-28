/**
 * Skill assembly — builds a SKILL.md file from frontmatter + content.
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface SkillFrontmatter {
  name: string;
  description: string;
  "user-invocable"?: boolean;
  "argument-hint"?: string;
}

export interface SkillDefinition {
  frontmatter: SkillFrontmatter;
  content: string;
}

function serializeFrontmatter(fm: SkillFrontmatter): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${typeof value === "string" ? value : String(value)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export function buildSkillContent(skill: SkillDefinition): string {
  return `${serializeFrontmatter(skill.frontmatter)}\n\n${skill.content}\n`;
}

export function writeSkill(path: string, skill: SkillDefinition): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buildSkillContent(skill), "utf-8");
  console.log(`  wrote ${path}`);
}

export function writeJSON(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`  wrote ${path}`);
}

export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
  console.log(`  wrote ${path}`);
}
