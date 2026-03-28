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
      "Shared reference — config defaults, presets, and tracking strategy artifact map",
  },
  content: `\
# twisted-workflow shared reference

Config defaults, preset definitions, and strategy artifact mapping.
Sub-skills reference source files in \`src/\` directly for shared logic.

---

${render("config.eta")}

---

${render("strategies.eta")}
`,
};
