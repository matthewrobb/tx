import { MarkdownDocument, md } from "build-md";
import type { SkillDefinition } from "../lib/skill.js";
import { extractDeclaration } from "../lib/extract.js";

const doc = new MarkdownDocument()
  .heading(1, "twisted-workflow shared reference")
  .paragraph("Config resolution, preset composition, and tracking strategy artifact mapping.")
  .rule()
  .heading(2, "Config Resolution")
  .paragraph("Read `src/config/resolve.ts` for the full implementation. Read `src/config/defaults.ts` for default values. Read `presets/{name}.json` for each active preset's overrides.")
  .code("ts", extractDeclaration("src/config/resolve.ts", "resolveConfig"))
  .code("ts", extractDeclaration("src/config/merge.ts", "deepMerge"))
  .heading(2, "Presets")
  .paragraph("Each preset is a sparse JSON file in `presets/`. Read the file for the active preset to see what it overrides.")
  .table(
    [{ heading: "Preset" }, { heading: "File" }, { heading: "What it overrides" }],
    [
      [md.code("twisted"), md.code("presets/twisted.json"), "tracking → twisted artifact format"],
      [md.code("superpowers"), md.code("presets/superpowers.json"), "TDD discipline, code review → Superpowers"],
      [md.code("gstack"), md.code("presets/gstack.json"), "tracking → gstack, all delegatable phases → gstack commands"],
      [md.code("nimbalyst"), md.code("presets/nimbalyst.json"), "tracking → nimbalyst, research + code review → Nimbalyst"],
      [md.code("minimal"), md.code("presets/minimal.json"), "all delegatable phases → skip, tests deferred"],
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
    description: "Shared reference — config resolution, presets, and tracking strategy artifact map",
  },
  content: doc,
};
