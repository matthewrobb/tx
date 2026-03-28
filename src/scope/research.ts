/**
 * Research step — provider dispatch + built-in research.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import { parseProvider } from "../pipeline/routing.js";
import { advanceState } from "../state/machine.js";
import { writeResearch, type ResearchAgent } from "../strategies/writer.js";

/**
 * Execute the research step.
 * Checks the provider config and either delegates, skips, or runs built-in research.
 */
export function executeResearch(
  config: TwistedConfig,
  state: ObjectiveState,
  objective: string,
  objDir: string,
  yolo: boolean,
): ObjectiveState {
  const { provider, fallback } = config.pipeline.research;

  // Skip — mark complete and advance
  if (provider === "skip") {
    return advanceState(state, config.pipeline);
  }

  // Delegate to external provider
  if (provider !== "built-in") {
    const parsed = parseProvider(provider);
    // parsed.type: "nimbalyst" | "gstack" | "superpowers" | ...
    // parsed.skill: "deep-researcher" | parsed.command: "/office-hours"
    // If provider unavailable, try fallback
    invoke(provider, fallback);

    return advanceState(state, config.pipeline, provider);
  }

  // Built-in research — spawn parallel agents
  const agents = runBuiltInResearch(config, objective);

  // Write for ALL active tracking strategies
  for (const strategy of config.tracking) {
    writeResearch(strategy, objective, objDir, agents, {
      nimbalystConfig: config.nimbalyst,
    });
  }

  // Handoff: display config.strings.handoff_messages.research_to_scope
  return advanceState(state, config.pipeline, "built-in");
}

/**
 * Built-in research — spawn parallel subagents to explore the codebase.
 *
 * Each agent gets a distinct focus area and returns structured findings.
 * Focus areas are determined by analyzing the objective against the codebase.
 * Each area should be independently explorable without overlap.
 */
export function runBuiltInResearch(
  config: TwistedConfig,
  objective: string,
): ResearchAgent[] {
  // Determine focus areas — judgment call based on objective + codebase
  const focusAreas = determineFocusAreas(objective);

  // Spawn one subagent per focus area in parallel
  const agents = parallel(
    focusAreas.map((focus, i) => {
      const prompt = config.strings.research_agent_prompt
        .replace("{objective}", objective)
        .replace("{focus}", focus)
        .replace("{codebase_context}", summarizeContext());

      // Each agent returns: { agentNumber, focus, findings, keyFiles, patterns, concerns }
      return spawnSubagent(prompt, i + 1, focus);
    }),
  );

  return agents;
}
