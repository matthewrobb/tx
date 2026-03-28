import type { SkillDefinition } from "../../lib/skill.js";
import { renderSkill } from "../../lib/eta.js";

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "twisted-work",
    description: "Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands",
    "user-invocable": true,
    "argument-hint": "[init | status [objective] | next [objective] | resume {objective} | scope | decompose | execute | review | ship | config [section] [subsection]] [--yolo]",
  },
  content: renderSkill(import.meta.dirname, "skill.eta", [
    "src/work/router.ts",
    "src/work/init.ts",
    "src/work/advance.ts",
    "src/work/config-display.ts",
  ]),
};
