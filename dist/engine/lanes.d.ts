/**
 * Lane advancement — determines the next lane for an epic to move into.
 *
 * An epic can advance to the next lane when:
 * 1. All steps in the current lane are complete.
 * 2. The next lane's entry_requires predicates all pass.
 */
import type { LaneConfig, TwistedConfig, EngineResult } from "../types/index.js";
import type { PredicateContext } from "./predicates.js";
/**
 * Find the lane config by directory name.
 *
 * @param config - v4 config.
 * @param dir - Lane directory name (e.g. "2-active").
 */
export declare function findLane(config: TwistedConfig, dir: string): LaneConfig | undefined;
/**
 * Compute the sequence of lanes this epic should traverse based on its type.
 *
 * @param config - v4 config.
 * @param epicType - Epic type string.
 */
export declare function laneSequenceForType(config: TwistedConfig, epicType: string): string[];
/**
 * Determine the next lane in the sequence after the current lane.
 *
 * @param config - v4 config.
 * @param epicType - Epic type.
 * @param currentLaneDir - Current lane directory name.
 */
export declare function nextLane(config: TwistedConfig, epicType: string, currentLaneDir: string): string | null;
/**
 * Check whether an epic can advance to the given lane.
 *
 * Entry requires predicates are evaluated; if the lane has no entry_requires, advancement is always allowed.
 *
 * @param lane - Target lane.
 * @param ctx - Predicate evaluation context.
 */
export declare function canEnterLane(lane: LaneConfig, ctx: PredicateContext): boolean;
/**
 * Compute the lane advancement result.
 *
 * @param config - v4 config.
 * @param epicType - Epic type.
 * @param currentLaneDir - Current lane directory name.
 * @param allStepsComplete - Whether all steps in the current lane are done.
 * @param ctx - Predicate evaluation context.
 */
export declare function computeAdvancement(config: TwistedConfig, epicType: string, currentLaneDir: string, allStepsComplete: boolean, ctx: PredicateContext): EngineResult;
//# sourceMappingURL=lanes.d.ts.map