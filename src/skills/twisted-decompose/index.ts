import type { SkillDefinition } from "../../lib/skill.js";
import { renderSkill } from "../../lib/eta.js";

export const twistedDecompose: SkillDefinition = {
  frontmatter: {
    name: "twisted-decompose",
    description: "Internal sub-skill — complexity estimation, issue breakdown, dependency analysis, and execution planning",
  },
  content: renderSkill(import.meta.dirname, "skill.eta", [
    "src/decompose/arch-review.ts",
    "src/decompose/breakdown.ts",
  ]),
};
