/**
 * Build script — generates SKILL.md files, preset JSON, and JSON Schema
 * from TypeScript source. Run with: bun run build
 */

import { resolve } from "path";
import { writeJSON, writeSkill, writeFile } from "./lib/skill.js";
import { allPresets } from "../src/presets/index.js";

import { usingTwistedWorkflow } from "./skills/using-twisted-workflow.js";
import { twistedWork } from "./skills/twisted-work.js";
import { twistedScope } from "./skills/twisted-scope.js";
import { twistedDecompose } from "./skills/twisted-decompose.js";
import { twistedExecute } from "./skills/twisted-execute.js";

const ROOT = resolve(import.meta.dirname, "..");

console.log("Building twisted-workflow...\n");

// --- Presets ---
console.log("Presets:");
for (const [name, preset] of Object.entries(allPresets)) {
  writeJSON(`${ROOT}/presets/${name}.json`, preset);
}

// --- Skills ---
console.log("\nSkills:");
writeSkill(`${ROOT}/skills/using-twisted-workflow/SKILL.md`, usingTwistedWorkflow);
writeSkill(`${ROOT}/skills/twisted-work/SKILL.md`, twistedWork);
writeSkill(`${ROOT}/skills/twisted-scope/SKILL.md`, twistedScope);
writeSkill(`${ROOT}/skills/twisted-decompose/SKILL.md`, twistedDecompose);
writeSkill(`${ROOT}/skills/twisted-execute/SKILL.md`, twistedExecute);

// --- Schema ---
console.log("\nSchema:");
import { generateSchema } from "./schema/settings.js";
writeJSON(`${ROOT}/schemas/settings.schema.json`, generateSchema());

console.log("\nDone.");
