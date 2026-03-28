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

// Files this skill extracts functions from
const EXTRACTED_FROM = [
  "src/scope/research.ts",
  "src/scope/interrogate.ts",
  "src/scope/requirements.ts",
  "src/scope/objective.ts",
  "src/strategies/writer.ts", // ResearchAgent interface
];

const body = `\
# twisted-scope

Internal sub-skill loaded by \`/twisted-work\`. Handles **research** and **scope** steps.

---

${render("research.eta")}

---

${render("scope.eta")}
`;

export const twistedScope: SkillDefinition = {
  frontmatter: {
    name: "twisted-scope",
    description:
      "Internal sub-skill — research delegation and requirements interrogation",
  },
  content: buildSkillWithImports(body, EXTRACTED_FROM),
};
