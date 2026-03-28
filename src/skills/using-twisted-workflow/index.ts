import type { SkillDefinition } from "../../lib/skill.js";
import { renderSkill } from "../../lib/eta.js";

export const usingTwistedWorkflow: SkillDefinition = {
  frontmatter: {
    name: "using-twisted-workflow",
    description: "Shared reference — config defaults, presets, and tracking strategy artifact map",
  },
  content: renderSkill(import.meta.dirname, "skill.eta", [
    "src/config/defaults.ts",
  ]),
};
