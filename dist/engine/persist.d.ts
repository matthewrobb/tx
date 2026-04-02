/**
 * XState snapshot persistence — save and restore machine state to/from disk.
 *
 * Snapshots are stored as JSON in the epic's lane directory at state.json.
 * This allows any session to resume an epic exactly where it left off.
 */
import { type Snapshot } from "xstate";
import type { EpicMachine } from "./machine.js";
/**
 * Save an XState actor snapshot to disk.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param snapshot - The snapshot to persist.
 */
export declare function saveSnapshot(epicDir: string, snapshot: Snapshot<unknown>): void;
/**
 * Load a persisted snapshot from disk, or return null if none exists.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 */
export declare function loadSnapshot(epicDir: string): Snapshot<unknown> | null;
/**
 * Create an XState actor, optionally rehydrating from a persisted snapshot.
 *
 * @param machine - The epic machine definition.
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param input - Initial context (used only when no snapshot exists).
 */
export declare function createOrRehydrateActor(machine: EpicMachine, epicDir: string, input: Parameters<typeof machine.provide>[0] extends never ? never : import("../types/xstate.js").EpicContext): import("xstate").Actor<import("xstate").StateMachine<import("../types/xstate.js").EpicContext, {
    type: "ADVANCE";
} | {
    type: "BLOCK";
    reason: string;
} | {
    type: "COMPLETE";
} | {
    type: "ERROR";
    error: string;
}, {}, never, {
    type: "setResult";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setError";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "clearError";
    params: import("xstate").NonReducibleUnknown;
}, never, never, "error" | "active" | "complete" | "blocked", string, import("../types/xstate.js").EpicContext, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "epic";
    states: {
        readonly active: {};
        readonly blocked: {};
        readonly complete: {};
        readonly error: {};
    };
}>>;
//# sourceMappingURL=persist.d.ts.map