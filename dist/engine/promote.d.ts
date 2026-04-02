/**
 * Spike promotion — converts a spike epic into another type.
 *
 * When a spike is complete and its findings justify further work,
 * `tx promote <spike> --type feature` converts it in-place:
 * 1. Updates CoreState.type to the new type.
 * 2. Recomputes the lane sequence for the new type.
 * 3. Moves the epic to the first lane of the new sequence.
 */
import type { CoreState, TwistedConfig, EpicType } from "../types/index.js";
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
export declare function promoteEpic(twistedRoot: string, epicName: string, targetType: EpicType, config: TwistedConfig): PromoteResult;
//# sourceMappingURL=promote.d.ts.map