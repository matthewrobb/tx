import type { SkillDefinition } from "../../lib/skill.js";
import { renderSkill } from "../../lib/eta.js";

export const twistedExecute: SkillDefinition = {
  frontmatter: {
    name: "twisted-execute",
    description: "Internal sub-skill — parallel execution with worktrees, delegated review/qa/ship, and state tracking",
  },
  content: renderSkill(import.meta.dirname, "skill.eta", [
    "src/execute/run.ts",
    "src/execute/delegation.ts",
  ]),
};
