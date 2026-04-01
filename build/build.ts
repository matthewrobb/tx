/**
 * Build script — generates SKILL.md files, preset JSON, and JSON Schema
 * from TypeScript source. Run with: bun run build
 */

import { resolve } from "path";
import { writeJSON, writeSkill } from "./lib/skill.js";
import { allPresets } from "../src/presets/index.js";

import { twistedWork } from "./skills/twisted-work.js";

const ROOT = resolve(import.meta.dirname, "..");

console.log("Building twisted-workflow...\n");

// --- Presets ---
console.log("Presets:");
for (const [name, preset] of Object.entries(allPresets)) {
  writeJSON(`${ROOT}/presets/${name}.json`, preset);
}

// --- Skills ---
console.log("\nSkills:");
writeSkill(`${ROOT}/skills/twisted-work/SKILL.md`, twistedWork);

// --- Schema ---
console.log("\nSchema:");
import { generateSchema } from "./schema/settings.js";
writeJSON(`${ROOT}/schemas/settings.schema.json`, generateSchema());

console.log("\nDone.");
