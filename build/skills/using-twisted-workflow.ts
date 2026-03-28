import { MarkdownDocument, md } from "build-md";
import type { SkillDefinition } from "../lib/skill.js";
import { extractDeclaration } from "../lib/extract.js";

const doc = new MarkdownDocument()
  .heading(1, "twisted-workflow shared reference")
  .paragraph("Config defaults, preset definitions, and tracking strategy artifact mapping. Sub-skills reference source files in `src/` directly for shared logic.")
  .rule()
  .heading(2, "Built-in Defaults")
  .code("ts", extractDeclaration("src/config/defaults.ts", "defaults"))
  .heading(2, "Presets")
  .table(
    [{ heading: "Preset" }, { heading: "What it overrides" }],
    [
      [md.code("twisted"), "tracking → twisted artifact format"],
      [md.code("superpowers"), "TDD discipline, code review → Superpowers"],
      [md.code("gstack"), "tracking → gstack, all delegatable phases → gstack commands"],
      [md.code("nimbalyst"), "tracking → nimbalyst, research + code review → Nimbalyst"],
      [md.code("minimal"), "all delegatable phases → skip, tests deferred"],
    ],
  )
  .paragraph("First preset wins on conflict. Compose in any order:")
  .list([
    '`["superpowers", "gstack"]` → Superpowers wins for code review, gstack fills the rest',
    '`["gstack", "superpowers"]` → gstack wins for code review, TDD still active',
  ])
  .rule()
  .heading(2, "Tracking Strategy Artifact Map")
  .table(
    [{ heading: "Step" }, { heading: "twisted" }, { heading: "nimbalyst" }, { heading: "gstack" }],
    [
      ["Research", md.code("{objDir}/RESEARCH-{n}.md"), md.code("nimbalyst-local/plans/{objective}.md"), md.code("{objDir}/DESIGN.md")],
      ["Requirements", md.code("{objDir}/REQUIREMENTS.md"), "same plan doc (append)", md`${md.code("{objDir}/DESIGN.md")} (append)`],
      ["Plan", md.code("{objDir}/PLAN.md"), "same plan doc (checklist)", md`${md.code("{objDir}/PLAN.md")} (gstack format)`],
      ["Issues", md.code("{objDir}/ISSUES.md"), "embedded in plan doc", md.code("{objDir}/ISSUES.md")],
      ["Tracker", "—", md.code("nimbalyst-local/tracker/tasks.md"), "—"],
    ],
  )
  .toString();

export const usingTwistedWorkflow: SkillDefinition = {
  frontmatter: {
    name: "using-twisted-workflow",
    description: "Shared reference — config defaults, presets, and tracking strategy artifact map",
  },
  content: doc,
};
