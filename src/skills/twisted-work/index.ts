import { MarkdownDocument } from "build-md";
import type { SkillDefinition } from "../../lib/skill.js";
import { extractDeclaration } from "../../lib/extract.js";
import { resolveReadFirst, formatReadFirst } from "../../lib/imports.js";

const EXTRACTED_FROM = [
  "src/work/router.ts",
  "src/work/init.ts",
  "src/work/advance.ts",
  "src/work/config-display.ts",
];

const doc = new MarkdownDocument()
  .heading(1, "/twisted-work")
  .paragraph("The only user-facing skill. Routes to internal sub-skills based on arguments and objective state.")
  .rule()
  .heading(2, "Command Routing")
  .code("typescript", extractDeclaration("src/work/router.ts", "parseCommand"))
  .code("typescript", extractDeclaration("src/work/router.ts", "routeCommand"))
  .rule()
  .heading(2, "Init Flow")
  .code("typescript", extractDeclaration("src/work/init.ts", "executeInit"))
  .rule()
  .heading(2, "Next / Resume / Auto-Advance")
  .code("typescript", extractDeclaration("src/work/advance.ts", "executeNext"))
  .code("typescript", extractDeclaration("src/work/advance.ts", "executeResume"))
  .rule()
  .heading(2, "Config Display")
  .code("typescript", extractDeclaration("src/work/config-display.ts", "executeConfig"))
  .code("typescript", extractDeclaration("src/work/config-display.ts", "displayConfigOverview"))
  .toString();

const readFirst = formatReadFirst(resolveReadFirst(EXTRACTED_FROM, doc));

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "twisted-work",
    description: "Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands",
    "user-invocable": true,
    "argument-hint": "[init | status [objective] | next [objective] | resume {objective} | scope | decompose | execute | review | ship | config [section] [subsection]] [--yolo]",
  },
  content: readFirst + "\n" + doc,
};
