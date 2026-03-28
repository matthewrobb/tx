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

const EXTRACTED_FROM = [
  "src/work/router.ts",
  "src/work/init.ts",
  "src/work/advance.ts",
  "src/work/config-display.ts",
];

const body = `\
# /twisted-work

The only user-facing skill. Routes to internal sub-skills based on arguments and objective state.

---

${render("work.eta")}
`;

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "twisted-work",
    description:
      "Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands",
    "user-invocable": true,
    "argument-hint":
      "[init | status [objective] | next [objective] | resume {objective} | scope | decompose | execute | review | ship | config [section] [subsection]] [--yolo]",
  },
  content: buildSkillWithImports(body, EXTRACTED_FROM),
};
