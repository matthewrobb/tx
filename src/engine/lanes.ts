/**
 * Lane advancement — determines the next lane for an epic to move into.
 *
 * An epic can advance to the next lane when:
 * 1. All steps in the current lane are complete.
 * 2. The next lane's entry_requires predicates all pass.
 */

import type { LaneConfig, TwistedConfig } from "../types/config.js";
import type { EngineResult } from "../types/engine.js";
import type { PredicateContext } from "./predicates.js";
import { evaluateAllPredicates } from "./predicates.js";

/**
 * Find the lane config by directory name.
 *
 * @param config - v4 config.
 * @param dir - Lane directory name (e.g. "2-active").
 */
export function findLane(config: TwistedConfig, dir: string): LaneConfig | undefined {
  return config.lanes.find((l) => l.dir === dir);
}

/**
 * Compute the sequence of lanes this epic should traverse based on its type.
 *
 * @param config - v4 config.
 * @param epicType - Epic type string.
 */
export function laneSequenceForType(config: TwistedConfig, epicType: string): string[] {
  const typeConfig = config.types.find((t) => t.type === epicType);
  return typeConfig?.lanes ?? config.lanes.map((l) => l.dir);
}

/**
 * Determine the next lane in the sequence after the current lane.
 *
 * @param config - v4 config.
 * @param epicType - Epic type.
 * @param currentLaneDir - Current lane directory name.
 */
export function nextLane(
  config: TwistedConfig,
  epicType: string,
  currentLaneDir: string,
): string | null {
  const sequence = laneSequenceForType(config, epicType);
  const idx = sequence.indexOf(currentLaneDir);
  if (idx === -1 || idx === sequence.length - 1) return null;
  return sequence[idx + 1] ?? null;
}

/**
 * Check whether an epic can advance to the given lane.
 *
 * Entry requires predicates are evaluated; if the lane has no entry_requires, advancement is always allowed.
 *
 * @param lane - Target lane.
 * @param ctx - Predicate evaluation context.
 */
export function canEnterLane(lane: LaneConfig, ctx: PredicateContext): boolean {
  const entryRequires = lane.entry_requires ?? [];
  if (entryRequires.length === 0) return true;
  return evaluateAllPredicates(entryRequires, ctx);
}

/**
 * Compute the lane advancement result.
 *
 * @param config - v4 config.
 * @param epicType - Epic type.
 * @param currentLaneDir - Current lane directory name.
 * @param allStepsComplete - Whether all steps in the current lane are done.
 * @param ctx - Predicate evaluation context.
 */
export function computeAdvancement(
  config: TwistedConfig,
  epicType: string,
  currentLaneDir: string,
  allStepsComplete: boolean,
  ctx: PredicateContext,
): EngineResult {
  if (!allStepsComplete) {
    return { action: "wait", from_lane: currentLaneDir };
  }

  const targetDir = nextLane(config, epicType, currentLaneDir);

  if (!targetDir) {
    return { action: "complete", from_lane: currentLaneDir, message: "All lanes complete." };
  }

  const targetLane = findLane(config, targetDir);
  if (!targetLane) {
    return {
      action: "error",
      from_lane: currentLaneDir,
      to_lane: targetDir,
      message: `Lane not found: ${targetDir}`,
    };
  }

  if (!canEnterLane(targetLane, ctx)) {
    return {
      action: "wait",
      from_lane: currentLaneDir,
      to_lane: targetDir,
      message: `Entry requirements not met for lane: ${targetDir}`,
    };
  }

  return {
    action: "advance",
    from_lane: currentLaneDir,
    to_lane: targetDir,
  };
}
