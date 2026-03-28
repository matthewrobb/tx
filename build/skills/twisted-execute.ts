import { MarkdownDocument } from "build-md";
import type { SkillDefinition } from "../lib/skill.js";
import { extractDeclaration } from "../lib/extract.js";
import { resolveReadFirst, formatReadFirst } from "../lib/imports.js";

const EXTRACTED_FROM = [
  "src/execute/run.ts",
  "src/execute/delegation.ts",
];

const doc = new MarkdownDocument()
  .heading(1, "twisted-execute")
  .paragraph("Internal sub-skill loaded by `/twisted-work`. Handles **execute**, **code_review**, **qa**, and **ship** steps.")
  .rule()
  .heading(2, "Execute Step")
  .code("typescript", extractDeclaration("src/execute/run.ts", "readIssuesForExecute"))
  .code("typescript", extractDeclaration("src/execute/run.ts", "moveToInProgress"))
  .code("typescript", extractDeclaration("src/execute/run.ts", "executeGroups"))
  .rule()
  .heading(2, "Post-Execution Delegation")
  .code("typescript", extractDeclaration("src/execute/delegation.ts", "executeCodeReview"))
  .code("typescript", extractDeclaration("src/execute/delegation.ts", "executeQA"))
  .code("typescript", extractDeclaration("src/execute/delegation.ts", "executeShip"))
  .toString();

const readFirst = formatReadFirst(resolveReadFirst(EXTRACTED_FROM, doc));

export const twistedExecute: SkillDefinition = {
  frontmatter: {
    name: "twisted-execute",
    description: "Internal sub-skill — parallel execution with worktrees, delegated review/qa/ship, and state tracking",
  },
  content: readFirst + "\n" + doc,
};
