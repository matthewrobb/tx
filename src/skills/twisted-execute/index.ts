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

export const twistedExecute: SkillDefinition = {
  frontmatter: {
    name: "twisted-execute",
    description:
      "Internal sub-skill — parallel execution with worktrees, delegated review/qa/ship, and state tracking",
  },
  content: `\
# twisted-execute

Internal sub-skill loaded by \`/twisted-work\`. Handles **execute**, **code_review**, **qa**, and **ship** steps.

---

${render("execute.eta")}
`,
};
