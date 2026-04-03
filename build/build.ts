/**
 * Build script — generates SKILL.md files and JSON Schema
 * from TypeScript source. Run with: bun run build
 */

import { resolve } from "path";
import { writeJSON, writeSkill } from "./lib/skill.js";

import { twistedWork } from "./skills/twisted-work.js";

const ROOT = resolve(import.meta.dirname, "..");

console.log("Building twisted-workflow...\n");

// --- Skills ---
console.log("Skills:");
writeSkill(`${ROOT}/skills/tx/SKILL.md`, twistedWork);

// --- Schema ---
console.log("\nSchema:");
import { generateSchema } from "./schema/settings.js";
writeJSON(`${ROOT}/schemas/settings.schema.json`, generateSchema());

console.log("\nDone.");
