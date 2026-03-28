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

export const usingTwistedWorkflow: SkillDefinition = {
  frontmatter: {
    name: "using-twisted-workflow",
    description:
      "Use when any twisted-workflow skill is active — provides shared config, defaults, state machine, tracking strategies, and pipeline routing",
  },
  content: `\
# twisted-workflow shared config

Loaded automatically by \`/twisted-work\` and passed to internal sub-skills. This is the reference for all shared logic.

---

${render("config.eta")}

---

${render("state.eta")}

---

${render("strategies.eta")}
`,
};
