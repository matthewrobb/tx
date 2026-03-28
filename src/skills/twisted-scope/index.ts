/**
 * twisted-scope skill — assembled from .eta templates that extract
 * real code from the functional core at build time.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { SkillDefinition } from "../../lib/skill.js";
import { createEta, templateData } from "../../lib/eta.js";

const DIR = resolve(import.meta.dirname);
const eta = createEta(DIR);
const data = templateData();

function render(filename: string): string {
  return eta.renderString(readFileSync(resolve(DIR, filename), "utf-8"), data);
}

export const twistedScope: SkillDefinition = {
  frontmatter: {
    name: "twisted-scope",
    description:
      "Internal sub-skill — research delegation and requirements interrogation",
  },
  content: `\
# twisted-scope

Internal sub-skill loaded by \`/twisted-work\`. Handles **research** and **scope** steps.

---

${render("research.eta")}

---

${render("scope.eta")}
`,
};
