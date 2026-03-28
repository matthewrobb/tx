/**
 * Requirements interrogation — the core of the scope step.
 */

import type { TwistedConfig } from "../../types/config.js";

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
