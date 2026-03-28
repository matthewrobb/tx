/**
 * Scope step — requirements interrogation + strategy-aware output.
 */

import { table, ts } from "../../lib/markdown.js";
import { defaults } from "../../config/defaults.js";

const writerSignature = ts(`
// from src/strategies/writer.ts
function writeRequirements(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,  // category name → requirements
  opts: WriteOptions,
): string[]
`);

const strategyTable = table(
  ["Strategy", "Output location", "Format"],
  [
    ["`twisted`", "`{objDir}/REQUIREMENTS.md`", "RequirementsFrontmatter + requirements by category"],
    ["`nimbalyst`", "`nimbalyst-local/plans/{objective}.md` (append)", "Acceptance Criteria + Key Components + Behavioral Requirements + Constraints sections"],
    ["`gstack`", "`{objDir}/DESIGN.md` (append)", "Scope + Acceptance Criteria sections appended to design doc"],
  ],
);

const writeLoop = ts(`
// Write requirements for ALL active tracking strategies
for (const strategy of config.tracking) {
  writeRequirements(strategy, objective, objDir, categories, {
    projectRoot: ".",
    nimbalystConfig: config.nimbalyst,
  });
}
`);

const stateUpdate = ts(`
// from src/state/machine.ts
const newState = advanceState(state, config.pipeline, "built-in");
// state.step: "scope" → nextStep (arch_review or decompose, depending on skip config)
// state.steps_completed: [..., "scope"]
// state.tools_used.scope: "built-in"
`);

const categories = defaults.decompose.categories.map((c) => `\`"${c}"\``).join(", ");

export const scopeStep = `\
## Scope Step

### 1. Establish Objective Name (if needed)

If no objective folder exists yet (entering pipeline mid-stream):

- Ask: "What is the short name for this objective? Leave blank for auto-suggestions."
- Create the objective directory and initial \`state.md\` once confirmed.
- See \`using-twisted-workflow\` **Objective Naming** for the full flow.

### 2. Read Research (Strategy-Aware)

Read research from the primary tracking strategy's location:

\`\`\`typescript
// from src/strategies/paths.ts
const paths = getArtifactPaths(config.tracking[0], objective, objDir);
// twisted: read RESEARCH-*.md from objDir
// nimbalyst: read nimbalyst-local/plans/{objective}.md
// gstack: read DESIGN.md from objDir
\`\`\`

Synthesize a working understanding of findings before questioning.
If no research exists (skipped or direct entry), proceed with objective description only.

### 3. Interrogate the Human

This is the core of scope. **This is inherently interactive — \`--yolo\` does NOT skip it.**

Use categories from \`config.decompose.categories\` (default: [${categories}]).

For each category, use \`config.strings.interrogation_prompt\`:

> ${defaults.strings.interrogation_prompt}

Rules:
- Question **one category at a time** — do not dump a list of questions.
- Push back on vague answers. If an answer is ambiguous, say so and ask again.
- Drill until every requirement is concrete and testable.
- Do not interpret or embellish — capture exactly what the human said.
- Do not move to the next category until the current one is locked down.

### 4. Write Requirements (Strategy-Aware)

${writerSignature}

Output per strategy:

${strategyTable}

Write for ALL active tracking strategies:

${writeLoop}

### 5. Update State

${stateUpdate}

### 6. Handoff

Display \`config.strings.handoff_messages.scope_to_decompose\`:

> ${defaults.strings.handoff_messages.scope_to_decompose}

Return to \`/twisted-work\` for auto-advance.`;
