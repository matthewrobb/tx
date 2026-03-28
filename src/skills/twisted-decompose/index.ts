import { readFileSync } from "fs";
import { resolve } from "path";
import type { SkillDefinition } from "../../lib/skill.js";
import { createEta, templateData, buildSkillWithImports } from "../../lib/eta.js";

const DIR = resolve(import.meta.dirname);
const eta = createEta(DIR);
const data = templateData();

function render(filename: string): string {
  return eta.renderString(readFileSync(resolve(DIR, filename), "utf-8"), data);
}

const EXTRACTED_FROM = [
  "src/decompose/arch-review.ts",
  "src/decompose/breakdown.ts",
];

const body = `\
# twisted-decompose

Internal sub-skill loaded by \`/twisted-work\`. Handles **arch_review** and **decompose** steps.

---

${render("decompose.eta")}
`;

export const twistedDecompose: SkillDefinition = {
  frontmatter: {
    name: "twisted-decompose",
    description:
      "Internal sub-skill — complexity estimation, issue breakdown, dependency analysis, and execution planning",
  },
  content: buildSkillWithImports(body, EXTRACTED_FROM),
};
