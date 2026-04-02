/**
 * Vendor skill sync — copies mattpocock skills from vendor/ into skills/mattpocock/.
 *
 * Each skill is output as a directory: skills/mattpocock/{skill}/SKILL.md
 * A provenance header is prepended to every copied file.
 *
 * If vendor/mattpocock-skills/ is missing, it is cloned automatically.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const REPO_URL = "https://github.com/mattpocock/skills";

const SKILLS: { name: string; files: string[] }[] = [
  { name: "write-a-prd",   files: ["SKILL.md"] },
  { name: "grill-me",      files: ["SKILL.md"] },
  { name: "prd-to-plan",   files: ["SKILL.md"] },
  { name: "prd-to-issues", files: ["SKILL.md"] },
  {
    name: "tdd",
    files: [
      "SKILL.md",
      "deep-modules.md",
      "interface-design.md",
      "mocking.md",
      "refactoring.md",
      "tests.md",
    ],
  },
];

function provenanceHeader(skill: string, file: string): string {
  return [
    `<!-- Source: ${REPO_URL}/tree/main/${skill}/${file} -->`,
    `<!-- License: MIT — ${REPO_URL}/blob/main/LICENSE -->`,
    `<!-- Do not edit directly — regenerate with: npm run build -->`,
    "",
    "",
  ].join("\n");
}

export function syncVendorSkills(root: string): void {
  const vendorDir = join(root, "vendor", "mattpocock-skills");
  const outDir = join(root, "skills", "mattpocock");

  if (!existsSync(vendorDir)) {
    console.log(`  Cloning ${REPO_URL} → vendor/mattpocock-skills/`);
    execSync(`git clone ${REPO_URL} "${vendorDir}"`, { stdio: "inherit" });
  }

  mkdirSync(outDir, { recursive: true });

  for (const skill of SKILLS) {
    const skillOutDir = join(outDir, skill.name);
    mkdirSync(skillOutDir, { recursive: true });

    for (const file of skill.files) {
      const src = join(vendorDir, skill.name, file);
      const dest = join(skillOutDir, file);

      if (!existsSync(src)) {
        console.warn(`  WARN: missing ${skill.name}/${file} — skipping`);
        continue;
      }

      const content = readFileSync(src, "utf8");
      writeFileSync(dest, provenanceHeader(skill.name, file) + content);
    }

    console.log(`  ${skill.name} (${skill.files.length} file${skill.files.length > 1 ? "s" : ""})`);
  }
}
