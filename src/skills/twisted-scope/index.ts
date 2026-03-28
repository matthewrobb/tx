import type { SkillDefinition } from "../../lib/skill.js";

export const twistedScope: SkillDefinition = {
  frontmatter: {
    name: "twisted-scope",
    description:
      "Internal sub-skill — research delegation and requirements interrogation, produces RESEARCH-*.md and REQUIREMENTS.md",
  },
  content: `\
**REQUIRED:** Load the \`using-twisted-workflow\` skill for shared config, defaults, presets, string templates, and constraints. All section references below point to that skill.

# twisted-scope

You are the scope sub-skill, loaded by \`/twisted-work\`. You handle two pipeline steps: **research** and **scope**. You are not user-invocable — \`/twisted-work\` loads you when needed.

## On Every Invocation

1. Receive the resolved config and objective state from \`/twisted-work\`.
2. Determine which step to execute: research or scope (from \`state.md\` frontmatter).
3. Execute the appropriate step below.

---

## Research Step

### 1. Check Provider

Look up \`pipeline.research.provider\` in the resolved config:

- If \`"skip"\`: mark research complete, update \`state.md\`, return.
- If \`"built-in"\`: execute **Built-in Research** below.
- If external provider: delegate per **Provider Delegation**, then update \`state.md\`, return.

### 2. Built-in Research

#### a. Determine Research Areas

Analyze the objective description and codebase to identify distinct research focus areas. Each area should be independently explorable without overlap.

#### b. Spawn Parallel Research Agents

Spawn parallel subagents using the \`strings.research_agent_prompt\` template:

\`\`\`
Research the codebase for objective "{objective}".
Focus area: {focus}
Codebase context: {codebase_context}

Return structured findings: key files, patterns, concerns.
\`\`\`

Each agent explores its focus area and returns structured findings:
- Key files relevant to the focus area.
- Patterns found in the codebase.
- Concerns or risks identified.

#### c. Write Research Files

Use \`writeResearch\` from \`src/strategies/writer.ts\` to write output in the correct format for the active tracking strategy. Output locations per strategy:

| Strategy | Research output |
|---|---|
| \`twisted\` | \`RESEARCH-*.md\` in the objective folder |
| \`nimbalyst\` | \`nimbalyst-local/plans/{objective}.md\` |
| \`gstack\` | \`DESIGN.md\` in the objective folder |

For the twisted strategy, use the \`strings.research_section\` template for section headings:

\`\`\`
## Agent {n} — {focus}
\`\`\`

Each research file has \`ResearchFrontmatter\`:

\`\`\`yaml
---
objective: {objective}
agent_number: {n}
focus: {focus}
created: "{date}"
status: done
---
\`\`\`

Split across files by agent group: \`RESEARCH-1.md\`, \`RESEARCH-2.md\`, etc. One file per agent.

### 3. Update State

Update \`state.md\` frontmatter:
- Add \`research\` to \`steps_completed\`.
- Set \`step\` to \`scope\` (or skip to next non-skipped step).
- Remove \`research\` from \`steps_remaining\`.
- Record \`tools_used.research\` with the provider used.
- Update \`updated\` timestamp.

### 4. Handoff

Display \`strings.handoff_messages.research_to_scope\` with the research count.

If auto-advance continues, proceed to **Scope Step**. Otherwise return to \`/twisted-work\`.

---

## Scope Step

### 1. Establish Objective Name (if needed)

If no objective folder exists yet (entering pipeline mid-stream), follow **Objective Naming** from \`using-twisted-workflow\`:

- Ask: "What is the short name for this objective? Leave blank for auto-suggestions."
- Create the objective directory and initial \`state.md\` once the name is confirmed.

### 2. Read Research

Read all \`RESEARCH-*.md\` files from the objective folder. Synthesize a working understanding of findings before questioning.

If no research files exist (research was skipped or this is a direct entry), proceed to interrogation with only the objective description as context.

### 3. Interrogate the Human

This is the core of scope. Use the categories from \`decompose.categories\` in the resolved config (default: \`["scope", "behavior", "constraints", "acceptance"]\`).

For each category, use \`strings.interrogation_prompt\`:

\`\`\`
Let's drill into {category}. Tell me everything about this area — be specific and concrete. I will push back on anything vague.
\`\`\`

Rules:
- Question **one category at a time** — do not dump a list of questions.
- Push back on vague answers. If an answer is ambiguous, say so and ask again.
- Drill until every requirement is concrete and testable.
- Do not interpret or embellish — capture exactly what the human said.
- Do not move to the next category until the current one is locked down.
- This phase is inherently interactive — \`--yolo\` does NOT skip the interrogation.

### 4. Write Requirements

Requirements output is strategy-aware. Use \`writeRequirements\` from \`src/strategies/writer.ts\`:

| Strategy | Requirements output |
|---|---|
| \`twisted\` | \`REQUIREMENTS.md\` in the objective folder |
| \`nimbalyst\` | Appended to \`nimbalyst-local/plans/{objective}.md\` |
| \`gstack\` | Appended to \`DESIGN.md\` in the objective folder |

For the twisted strategy, write \`REQUIREMENTS.md\` to the objective folder with \`RequirementsFrontmatter\`:

\`\`\`yaml
---
objective: {objective}
created: "{date}"
updated: "{timestamp}"
categories_completed:
  - scope
  - behavior
  - constraints
  - acceptance
categories_remaining: []
complete: true
---
\`\`\`

Content is a faithful record of what the human stated, organized by category. No interpretation.

### 5. Update State

Update \`state.md\` frontmatter:
- Add \`scope\` to \`steps_completed\`.
- Set \`step\` to the next non-skipped step (arch_review or decompose).
- Remove \`scope\` from \`steps_remaining\`.
- Record \`tools_used.scope: "built-in"\`.
- Update \`updated\` timestamp.

### 6. Handoff

Display \`strings.handoff_messages.scope_to_decompose\` with the category count.

Return to \`/twisted-work\` for auto-advance to continue.

---

## Constraints

- Follow all **Shared Constraints** from \`using-twisted-workflow\`.
- Objective folder must exist before any files are written.
- All files go in the objective folder under its current lane.
- All human-facing text uses string templates from the resolved config.
- Never fabricate requirements the human did not state.
- Research files use \`ResearchFrontmatter\`. Requirements use \`RequirementsFrontmatter\`.
- State transitions are atomic — update all frontmatter fields at once.`,
};
