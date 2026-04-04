/**
 * Build script — generates SKILL.md files, JSON Schema, and plugin files
 * from TypeScript source. Run with: npm run build
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { writeJSON, writeSkill } from "./lib/skill.js";

import { twistedWork } from "./skills/twisted-work.js";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const { version } = pkg;

console.log(`Building @twisted.works/tx v${version}...\n`);

// --- Skills ---
console.log("Skills:");
writeSkill(`${ROOT}/skills/tx/SKILL.md`, twistedWork);

// --- Schema ---
console.log("\nSchema:");
import { generateSchema } from "./schema/settings.js";
writeJSON(`${ROOT}/schemas/settings.schema.json`, generateSchema());

// --- Plugin files ---
console.log("\nPlugin:");

const pluginJson = {
  name: "tx",
  description: "tx — data-driven DAG workflow engine for agentic development with issues, cycles, sessions, and expression-based step automation.",
  version,
  author: { name: "Matthew Robb" },
  homepage: "https://github.com/matthewrobb/tx",
  repository: "https://github.com/matthewrobb/tx",
  license: "GPL-3.0-only",
  keywords: ["workflow", "kanban", "planning", "parallel", "agentic", "xstate", "stories"],
  skills: "./skills/",
};

const marketplaceJson = {
  name: "twisted.works",
  description: "tx — data-driven DAG workflow engine for agentic development",
  owner: { name: "Matthew Robb" },
  plugins: [
    {
      name: "tx",
      description: pluginJson.description,
      version,
      source: "./",
      author: { name: "Matthew Robb" },
    },
  ],
};

writeJSON(`${ROOT}/.claude-plugin/plugin.json`, pluginJson);
writeJSON(`${ROOT}/.claude-plugin/marketplace.json`, marketplaceJson);

console.log("\nDone.");
