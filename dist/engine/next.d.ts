/**
 * txNext() — the core engine function for advancing an epic one step.
 *
 * Algorithm:
 * 1. Load CoreState from state.json.
 * 2. Resolve v4 config.
 * 3. Find the current lane and evaluate its steps.
 * 4. If all steps complete → compute lane advancement.
 *    - If next lane available → move epic, update CoreState.
 *    - If no next lane → mark epic complete.
 * 5. If steps remain → return the active step with its status.
 * 6. Persist the updated CoreState.
 * 7. Return EngineResult.
 */
import type { CoreState, EngineResult, TwistedConfig } from "../types/index.js";
/**
 * Load CoreState from an epic's state.json.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 */
export declare function loadCoreState(epicDir: string): CoreState;
/**
 * Persist CoreState to state.json.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param state - Updated state to write.
 */
export declare function saveCoreState(epicDir: string, state: CoreState): void;
/**
 * Move an epic's directory from one lane to another.
 *
 * @param twistedRoot - Absolute path to .twisted/ root.
 * @param epicName - Epic directory name.
 * @param fromLaneDir - Source lane directory (e.g. "2-active").
 * @param toLaneDir - Target lane directory (e.g. "4-done").
 */
export declare function moveEpicToLane(twistedRoot: string, epicName: string, fromLaneDir: string, toLaneDir: string): void;
/**
 * Advance an epic one step using the artifact-driven engine.
 *
 * @param twistedRoot - Absolute path to .twisted/ root.
 * @param epicName - Name of the epic.
 * @param config - Resolved v4 config.
 */
export declare function txNext(twistedRoot: string, epicName: string, config: TwistedConfig): EngineResult;
//# sourceMappingURL=next.d.ts.map