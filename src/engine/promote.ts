/**
 * Spike promotion — converts a spike epic into another type.
 *
 * When a spike is complete and its findings justify further work,
 * `tx promote <spike> --type feature` converts it in-place:
 * 1. Updates CoreState.type to the new type.
 * 2. Recomputes the lane sequence for the new type.
 * 3. Moves the epic to the first lane of the new sequence.
 */

import { existsSync } from "fs";
import { join } from "path";
import type { CoreState } from "../types/state.js";
import type { TwistedConfig } from "../types/config.js";
import type { EpicType } from "../types/epic.js";
import { laneSequenceForType } from "./lanes.js";
import { moveEpicToLane, loadCoreState, saveCoreState } from "./next.js";

export interface PromoteResult {
  epic: string;
  from_type: EpicType;
  to_type: EpicType;
  from_lane: string;
  to_lane: string;
  state: CoreState;
}

/**
 * Promote a spike to a different epic type.
 *
 * @param twistedRoot - Absolute path to the project root.
 * @param epicName - Name of the spike epic to promote.
 * @param targetType - The new epic type (e.g. "feature", "chore").
 * @param config - Resolved v4 config.
 */
export function promoteEpic(
  twistedRoot: string,
  epicName: string,
  targetType: EpicType,
  config: TwistedConfig,
): PromoteResult {
  const twistedDir = join(twistedRoot, ".twisted");

  // Locate the epic across all lanes
  let epicDir: string | null = null;
  let currentLane: string | null = null;

  for (const lane of config.lanes) {
    const candidate = join(twistedDir, lane.dir, epicName);
    if (existsSync(join(candidate, "state.json"))) {
      epicDir = candidate;
      currentLane = lane.dir;
      break;
    }
  }

  if (!epicDir || !currentLane) {
    throw new Error(`Epic not found: ${epicName}`);
  }

  const state = loadCoreState(epicDir);
  const fromType = state.type;

  if (fromType !== "spike") {
    throw new Error(`Epic "${epicName}" is not a spike (type: "${fromType}")`);
  }

  // Compute new lane sequence and target
  const newSequence = laneSequenceForType(config, targetType);
  const targetLane = newSequence[0] ?? "0-backlog";

  // Move epic to the first lane of the new type sequence if needed
  if (targetLane !== currentLane) {
    moveEpicToLane(twistedDir, epicName, currentLane, targetLane);
  }

  const newEpicDir = join(twistedDir, targetLane, epicName);

  // Update state
  state.type = targetType;
  state.lane = targetLane;
  state.step = config.lanes.find((l) => l.dir === targetLane)?.steps[0]?.name ?? "start";
  state.status = "active";
  state.updated = new Date().toISOString();
  saveCoreState(newEpicDir, state);

  return {
    epic: epicName,
    from_type: fromType,
    to_type: targetType,
    from_lane: currentLane,
    to_lane: targetLane,
    state,
  };
}
