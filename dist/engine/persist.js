/**
 * XState snapshot persistence — save and restore machine state to/from disk.
 *
 * Snapshots are stored as JSON in the epic's lane directory at state.json.
 * This allows any session to resume an epic exactly where it left off.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createActor } from "xstate";
/** File name for persisted machine snapshots. */
const SNAPSHOT_FILE = "machine-snapshot.json";
/**
 * Save an XState actor snapshot to disk.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param snapshot - The snapshot to persist.
 */
export function saveSnapshot(epicDir, snapshot) {
    const path = join(epicDir, SNAPSHOT_FILE);
    writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf-8");
}
/**
 * Load a persisted snapshot from disk, or return null if none exists.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 */
export function loadSnapshot(epicDir) {
    const path = join(epicDir, SNAPSHOT_FILE);
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf-8"));
}
/**
 * Create an XState actor, optionally rehydrating from a persisted snapshot.
 *
 * @param machine - The epic machine definition.
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param input - Initial context (used only when no snapshot exists).
 */
export function createOrRehydrateActor(machine, epicDir, input) {
    const snapshot = loadSnapshot(epicDir);
    if (snapshot) {
        // XState v5 requires input even when restoring from snapshot; the snapshot overrides context.
        return createActor(machine, { snapshot, input: {} });
    }
    return createActor(machine, { input });
}
//# sourceMappingURL=persist.js.map