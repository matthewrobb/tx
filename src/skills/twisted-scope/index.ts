import type { SkillDefinition } from "../../lib/skill.js";
import { renderSkill } from "../../lib/eta.js";

const EXTRACTED_FROM = [
  "src/scope/research.ts",
  "src/scope/interrogate.ts",
  "src/scope/requirements.ts",
  "src/scope/objective.ts",
  "src/strategies/writer.ts",
];

export const twistedScope: SkillDefinition = {
  frontmatter: {
    name: "twisted-scope",
    description: "Internal sub-skill — research delegation and requirements interrogation",
  },
  content: renderSkill(import.meta.dirname, "skill.eta", EXTRACTED_FROM),
};
