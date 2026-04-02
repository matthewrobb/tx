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
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "fs";
import { join, dirname } from "path";
import { evaluateSteps, activeStep, laneComplete } from "./evaluate.js";
import { computeAdvancement, findLane } from "./lanes.js";
/**
 * Load CoreState from an epic's state.json.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 */
export function loadCoreState(epicDir) {
    const statePath = join(epicDir, "state.json");
    return JSON.parse(readFileSync(statePath, "utf-8"));
}
/**
 * Persist CoreState to state.json.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param state - Updated state to write.
 */
export function saveCoreState(epicDir, state) {
    const statePath = join(epicDir, "state.json");
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}
/**
 * Move an epic's directory from one lane to another.
 *
 * @param twistedRoot - Absolute path to .twisted/ root.
 * @param epicName - Epic directory name.
 * @param fromLaneDir - Source lane directory (e.g. "2-active").
 * @param toLaneDir - Target lane directory (e.g. "4-done").
 */
export function moveEpicToLane(twistedRoot, epicName, fromLaneDir, toLaneDir) {
    const source = join(twistedRoot, fromLaneDir, epicName);
    const target = join(twistedRoot, toLaneDir, epicName);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(source, target);
}
/**
 * Advance an epic one step using the artifact-driven engine.
 *
 * @param twistedRoot - Absolute path to .twisted/ root.
 * @param epicName - Name of the epic.
 * @param config - Resolved v4 config.
 */
export function txNext(twistedRoot, epicName, config) {
    // Locate the epic — search all lane directories
    let epicDir = null;
    let currentLaneDir = null;
    for (const lane of config.lanes) {
        const candidate = join(twistedRoot, lane.dir, epicName);
        if (existsSync(join(candidate, "state.json"))) {
            epicDir = candidate;
            currentLaneDir = lane.dir;
            break;
        }
    }
    if (!epicDir || !currentLaneDir) {
        return { action: "error", message: `Epic not found: ${epicName}` };
    }
    const state = loadCoreState(epicDir);
    const lane = findLane(config, currentLaneDir);
    if (!lane) {
        return { action: "error", from_lane: currentLaneDir, message: `Lane config not found: ${currentLaneDir}` };
    }
    const ctx = { epicDir, twistedRoot };
    // Evaluate all steps in the current lane
    const evaluations = evaluateSteps(lane, epicDir, ctx);
    if (!laneComplete(evaluations)) {
        const current = activeStep(evaluations);
        const evaluation = evaluations.find((e) => e.step === current);
        const missing = evaluation?.missing ?? [];
        // Update active step in state
        if (current && state.step !== current) {
            state.step = current;
            state.updated = new Date().toISOString();
            saveCoreState(epicDir, state);
        }
        return {
            action: missing.length > 0 ? "wait" : "wait",
            from_lane: currentLaneDir,
            from_step: current ?? undefined,
            message: missing.length > 0
                ? `Waiting for: ${missing.join(", ")}`
                : `Active step: ${current}`,
            evaluation: evaluations,
        };
    }
    // All steps complete — compute lane advancement
    const advancement = computeAdvancement(config, state.type, currentLaneDir, true, ctx);
    if (advancement.action === "advance" && advancement.to_lane) {
        // Move the epic directory to the new lane
        moveEpicToLane(twistedRoot, epicName, currentLaneDir, advancement.to_lane);
        const newEpicDir = join(twistedRoot, advancement.to_lane, epicName);
        const newLane = findLane(config, advancement.to_lane);
        const firstStep = newLane?.steps[0]?.name ?? "start";
        // Update state
        state.lane = advancement.to_lane;
        state.step = firstStep;
        state.status = "active";
        state.updated = new Date().toISOString();
        saveCoreState(newEpicDir, state);
    }
    else if (advancement.action === "complete") {
        state.status = "done";
        state.updated = new Date().toISOString();
        saveCoreState(epicDir, state);
    }
    return advancement;
}
//# sourceMappingURL=next.js.map