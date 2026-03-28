import { MarkdownDocument } from "build-md";
import type { SkillDefinition } from "../lib/skill.js";
import { extractDeclaration } from "../lib/extract.js";
import { resolveReadFirst, formatReadFirst } from "../lib/imports.js";

const EXTRACTED_FROM = [
  "src/decompose/arch-review.ts",
  "src/decompose/breakdown.ts",
];

const doc = new MarkdownDocument()
  .heading(1, "twisted-decompose")
  .paragraph("Internal sub-skill loaded by `/twisted-work`. Handles **arch_review** and **decompose** steps.")
  .rule()
  .heading(2, "Arch Review Step")
  .code("typescript", extractDeclaration("src/decompose/arch-review.ts", "executeArchReview"))
  .rule()
  .heading(2, "Decompose Step")
  .code("typescript", extractDeclaration("src/decompose/breakdown.ts", "readInputsForDecompose"))
  .code("typescript", extractDeclaration("src/decompose/breakdown.ts", "estimateComplexity"))
  .code("typescript", extractDeclaration("src/decompose/breakdown.ts", "decomposeIntoIssues"))
  .code("typescript", extractDeclaration("src/decompose/breakdown.ts", "writeDecomposeOutput"))
  .toString();

const readFirst = formatReadFirst(resolveReadFirst(EXTRACTED_FROM, doc));

export const twistedDecompose: SkillDefinition = {
  frontmatter: {
    name: "twisted-decompose",
    description: "Internal sub-skill — complexity estimation, issue breakdown, dependency analysis, and execution planning",
  },
  content: readFirst + "\n" + doc,
};
