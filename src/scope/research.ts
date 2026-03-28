/**
 * Research step — provider dispatch + built-in research.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { dispatchPhase, forEachStrategy } from "../pipeline/dispatch.js";
import { advanceState } from "../state/machine.js";
import { writeResearch, type ResearchAgent } from "../strategies/writer.js";

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
