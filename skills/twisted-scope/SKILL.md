---
name: twisted-scope
description: Internal sub-skill — research delegation and requirements interrogation
---

**Read first:** These source files contain shared functions referenced below:
- `src/pipeline/dispatch.ts`
- `src/state/machine.ts`
- `src/strategies/paths.ts`

# twisted-scope

Internal sub-skill loaded by `/twisted-work`. Handles **research** and **scope** steps.

---

## Research Step

```typescript
/**
 * Execute the research step.
 * Uses dispatchPhase for provider check — see using-twisted-workflow for details.
 */
export function executeResearch(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
): ObjectiveState {
  const { action, newState } = dispatchPhase("research", config, state);
  if (action !== "built-in") return newState;

  // Built-in research
  const agents = runBuiltInResearch(config, objective);

  forEachStrategy(config, (strategy) => {
    writeResearch(strategy, objective, objDir, agents, {
      nimbalystConfig: config.nimbalyst,
    });
  });

  // Handoff: display config.strings.handoff_messages.research_to_scope
  return advanceState(state, config.pipeline, "built-in");
}
```
### Built-in Research

```typescript
/**
 * Built-in research — spawn parallel subagents to explore the codebase.
 *
 * Each agent gets a distinct focus area and returns structured findings.
 * Focus areas are determined by analyzing the objective against the codebase —
 * judgment call, each area independently explorable without overlap.
 */
export function runBuiltInResearch(
  config: TwistedConfig,
  objective: string,
): ResearchAgent[] {
  const focusAreas = determineFocusAreas(objective);

  return parallel(
    focusAreas.map((focus, i) => {
      const prompt = config.strings.research_agent_prompt
        .replace("{objective}", objective)
        .replace("{focus}", focus)
        .replace("{codebase_context}", summarizeContext());

      return spawnSubagent(prompt, i + 1, focus);
    }),
  );
}
```
```typescript
// ---------------------------------------------------------------------------
// Research writing
// ---------------------------------------------------------------------------

export interface ResearchAgent {
  agentNumber: number;
  focus: string;
  findings: string;
  keyFiles: string[];
  patterns: string[];
  concerns: string[];
}
```
---

## Scope Step

```typescript
/**
 * Establish the objective name and create the objective directory.
 * Called when entering the pipeline without an existing objective.
 */
export function establishObjective(
  config: TwistedConfig,
): { objective: string; objDir: string; state: ObjectiveState } {
  // Ask: "What is the short name for this objective?
  //        Leave blank for auto-suggestions."
  const name = askUser("objective name prompt");

  let objective: string;
  if (name) {
    objective = name;
  } else {
    // Spawn single fast scout agent for minimal codebase scan
    // Suggest 3 names using config.writing quality rules
    const suggestions = suggestNames(3, config.writing);
    objective = askUser(pickFrom(suggestions));
  }

  // Fallback: zero-padded numeric increment
  // e.g. "001", "002" based on total folders across all lanes
  if (!objective) {
    objective = nextIncrementName(config.naming);
  }

  const objDir = objectiveDir(
    objective,
    "todo",
    config.state,
    config.directories,
  );
  createDir(objDir);

  const state = createInitialState(objective, config.pipeline);
  writeStateFrontmatter(objDir, state);

  return { objective, objDir, state };
}
```
```typescript
/**
 * Read research from the primary tracking strategy's location.
 * Falls back gracefully if research was skipped or doesn't exist.
 */
export function readResearchForScope(
  config: TwistedConfig,
  objective: string,
  objDir: string,
): string | null {
  const primaryStrategy = config.tracking[0] ?? "twisted";
  const paths = getArtifactPaths(primaryStrategy, objective, objDir);

  switch (primaryStrategy) {
    case "twisted":
      return readGlob(`${objDir}/RESEARCH-*.md`);
    case "nimbalyst":
      // Plan doc — research is in Goals + Problem Description sections
      return readFile(`nimbalyst-local/plans/${objective}.md`);
    case "gstack":
      // Design doc — research is in Vision + Detailed Design sections
      return readFile(`${objDir}/DESIGN.md`);
    default:
      return readGlob(`${objDir}/RESEARCH-*.md`);
  }
}
```
```typescript
/**
 * Interrogate the human one category at a time.
 *
 * --yolo does NOT skip this — it is inherently interactive.
 * The human's answers ARE the requirements — capture exactly what
 * they said. No interpretation, no synthesis, no embellishment.
 */
export function interrogate(
  config: TwistedConfig,
): Record<string, string[]> {
  const results: Record<string, string[]> = {};

  // Default categories: ["scope", "behavior", "constraints", "acceptance"]
  for (const category of config.decompose.categories) {
    // ONE category at a time — do NOT batch or dump a list of questions
    const prompt = config.strings.interrogation_prompt
      .replace("{category}", category);
    display(prompt);

    // Push back on vague answers:
    //   "needs to be fast" → "what latency target? p50? p99?"
    //   "should handle errors" → "which errors? what recovery behavior?"
    //   "make it scalable" → "what load? how many concurrent users?"
    // Drill until every requirement is concrete and testable.
    // Do NOT move to next category until this one is locked down.
    const requirements = drillUntilConcrete();

    results[category] = requirements;
  }

  return results;
}
```
```typescript
/**
 * Write requirements and advance state.
 * Uses forEachStrategy — see using-twisted-workflow for the shared pattern.
 */
export function writeAndAdvance(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,
): ObjectiveState {
  forEachStrategy(config, (strategy) => {
    writeRequirements(strategy, objective, objDir, categories, {
      nimbalystConfig: config.nimbalyst,
    });
  });

  // Handoff: display config.strings.handoff_messages.scope_to_decompose
  return advanceState(state, config.pipeline, "built-in");
}
```
