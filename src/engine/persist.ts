/**
 * XState snapshot persistence — save and restore machine state to/from disk.
 *
 * Snapshots are stored as JSON in the epic's lane directory at state.json.
 * This allows any session to resume an epic exactly where it left off.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createActor, type Snapshot } from "xstate";
import type { EpicMachine } from "./machine.js";

/** File name for persisted machine snapshots. */
const SNAPSHOT_FILE = "machine-snapshot.json";

/**
 * Save an XState actor snapshot to disk.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param snapshot - The snapshot to persist.
 */
export function saveSnapshot(epicDir: string, snapshot: Snapshot<unknown>): void {
  const path = join(epicDir, SNAPSHOT_FILE);
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf-8");
}

/**
 * Load a persisted snapshot from disk, or return null if none exists.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 */
export function loadSnapshot(epicDir: string): Snapshot<unknown> | null {
  const path = join(epicDir, SNAPSHOT_FILE);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Snapshot<unknown>;
}

/**
 * Create an XState actor, optionally rehydrating from a persisted snapshot.
 *
 * @param machine - The epic machine definition.
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param input - Initial context (used only when no snapshot exists).
 */
export function createOrRehydrateActor(
  machine: EpicMachine,
  epicDir: string,
  input: Parameters<typeof machine.provide>[0] extends never ? never : import("../types/xstate.js").EpicContext,
) {
  const snapshot = loadSnapshot(epicDir);

  if (snapshot) {
    // XState v5 requires input even when restoring from snapshot; the snapshot overrides context.
    return createActor(machine, { snapshot, input: {} as import("../types/xstate.js").EpicContext });
  }

  return createActor(machine, { input });
}
