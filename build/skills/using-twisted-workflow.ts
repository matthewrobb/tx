import type { SkillDefinition } from "../lib/skill.js";

const CONTENT = `
# twisted-workflow Reference

A configurable orchestration layer for agentic development with Claude Code.

## Installation

\`\`\`bash
npx twisted-workflow init
# or use the tx binary after install
\`\`\`

## Quick Start

\`\`\`bash
tx init                    # Initialize project
tx open my-feature         # Start working on a feature
tx status                  # Check progress
tx next                    # Advance pipeline
\`\`\`

## Config

Settings live in \`.twisted/settings.json\`. The schema at \`schemas/settings.schema.json\` provides autocomplete in editors that support JSON Schema.

\`\`\`json
{
  "$schema": "./schemas/settings.schema.json",
  "presets": ["superpowers"],
  "pipeline": {
    "research": { "provider": "skip" }
  }
}
\`\`\`

## Config Resolution

Three-layer merge: \`deepMerge(defaults, ...presets, projectSettings)\`

First preset wins. Built-in presets: \`twisted\`, \`superpowers\`, \`minimal\`.

## Pipeline

**5 steps:** research → scope → plan → build → close

Each step can be delegatable (research) or hook-based (arch_review, code_review, qa, ship within build/close).

## Provider Strings

- \`"built-in"\` — handled directly
- \`"skip"\` — skip this step
- \`"ask"\` — prompt user each time
- \`"superpowers:skill-name"\` — delegate to a superpowers skill

## Run \`tx --help\` for full command reference.
`;

export const usingTwistedWorkflow: SkillDefinition = {
  frontmatter: {
    name: "using-twisted-workflow",
    description: "Shared reference — config resolution, presets, and CLI command reference for twisted-workflow v3",
  },
  content: CONTENT,
};
