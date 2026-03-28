/**
 * Research step — strategy-aware research output.
 *
 * This module generates the research section of the twisted-scope skill.
 * The actual writing logic lives in src/strategies/writer.ts (writeResearch).
 * This module generates the SKILL.md content that tells Claude how to use it.
 */

import { table, codeblock, ts } from "../../lib/markdown.js";
import { defaults } from "../../config/defaults.js";

// The actual writeResearch function signature, embedded as a code block
const writerSignature = ts(`
// from src/strategies/writer.ts
function writeResearch(
  strategy: TrackingStrategy,  // from config.tracking
  objective: string,
  objDir: string,
  agents: ResearchAgent[],     // one per parallel research agent
  opts: WriteOptions,
): string[]                    // returns paths of written files
`);

const strategyTable = table(
  ["Strategy", "Output location", "Format"],
  [
    ["`twisted`", "`{objDir}/RESEARCH-{n}.md`", "ResearchFrontmatter + findings per agent"],
    ["`nimbalyst`", "`nimbalyst-local/plans/{objective}.md`", "NimbalystPlanFrontmatter, research as Goals + Problem Description"],
    ["`gstack`", "`{objDir}/DESIGN.md`", "gstack design doc: Vision, Constraints, Alternatives, Detailed Design"],
  ],
);

const researchAgentInterface = ts(`
// from src/strategies/writer.ts
interface ResearchAgent {
  agentNumber: number;
  focus: string;
  findings: string;
  keyFiles: string[];
  patterns: string[];
  concerns: string[];
}
`);

const writeLoop = ts(`
// Write research artifacts for ALL active tracking strategies
for (const strategy of config.tracking) {
  writeResearch(strategy, objective, objDir, agents, {
    projectRoot: ".",
    nimbalystConfig: config.nimbalyst,
  });
}
`);

const stateUpdate = ts(`
// from src/state/machine.ts
const newState = advanceState(state, config.pipeline, "built-in");
// state.step: "research" → "scope"
// state.steps_completed: [..., "research"]
// state.tools_used.research: provider
`);

export const researchStep = `\
## Research Step

### 1. Check Provider

\`\`\`typescript
// from src/pipeline/routing.ts
const { provider } = config.pipeline.research;

if (provider === "skip") {
  // mark complete, advance state, return
} else if (provider === "built-in") {
  // execute Built-in Research below
} else {
  // delegate: parseProvider(provider) → invoke external tool
  // e.g. "nimbalyst:deep-researcher" → invoke nimbalyst skill
  // e.g. "gstack:/office-hours" → invoke gstack command
}
\`\`\`

### 2. Built-in Research

#### a. Determine Research Areas

Analyze the objective description and codebase to identify distinct research focus areas. Each area should be independently explorable without overlap.

#### b. Spawn Parallel Research Agents

Spawn parallel subagents using \`config.strings.research_agent_prompt\`:

\`\`\`
${defaults.strings.research_agent_prompt}
\`\`\`

Each agent returns structured findings:

${researchAgentInterface}

#### c. Write Research Files (Strategy-Aware)

${writerSignature}

Output per strategy:

${strategyTable}

Write for ALL active tracking strategies (primary + additional):

${writeLoop}

### 3. Update State

${stateUpdate}

### 4. Handoff

Display \`config.strings.handoff_messages.research_to_scope\`:

> ${defaults.strings.handoff_messages.research_to_scope}

If auto-advance continues, proceed to **Scope Step**. Otherwise return to \`/twisted-work\`.`;
