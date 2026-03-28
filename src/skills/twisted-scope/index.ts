import { MarkdownDocument } from "build-md";
import type { SkillDefinition } from "../../lib/skill.js";
import { extractDeclaration } from "../../lib/extract.js";
import { resolveReadFirst, formatReadFirst } from "../../lib/imports.js";

const EXTRACTED_FROM = [
  "src/scope/research.ts",
  "src/scope/interrogate.ts",
  "src/scope/requirements.ts",
  "src/scope/objective.ts",
  "src/strategies/writer.ts",
];

const doc = new MarkdownDocument()
  .heading(1, "twisted-scope")
  .paragraph("Internal sub-skill loaded by `/twisted-work`. Handles **research** and **scope** steps.")
  .rule()
  .heading(2, "Research Step")
  .code("typescript", extractDeclaration("src/scope/research.ts", "executeResearch"))
  .heading(3, "Built-in Research")
  .code("typescript", extractDeclaration("src/scope/research.ts", "runBuiltInResearch"))
  .code("typescript", extractDeclaration("src/strategies/writer.ts", "ResearchAgent"))
  .rule()
  .heading(2, "Scope Step")
  .code("typescript", extractDeclaration("src/scope/objective.ts", "establishObjective"))
  .code("typescript", extractDeclaration("src/scope/requirements.ts", "readResearchForScope"))
  .code("typescript", extractDeclaration("src/scope/interrogate.ts", "interrogate"))
  .code("typescript", extractDeclaration("src/scope/requirements.ts", "writeAndAdvance"))
  .toString();

const readFirst = formatReadFirst(resolveReadFirst(EXTRACTED_FROM, doc));

export const twistedScope: SkillDefinition = {
  frontmatter: {
    name: "twisted-scope",
    description: "Internal sub-skill — research delegation and requirements interrogation",
  },
  content: readFirst + "\n" + doc,
};
