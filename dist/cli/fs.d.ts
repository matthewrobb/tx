import type { CoreState, Task, Note, ActiveSession, SessionSummary } from "../types/index.js";
type SettingsData = Record<string, unknown>;
export declare function findRoot(cwd: string): string;
export declare function twistedDir(root: string): string;
export declare function objectiveDir(root: string, lane: string, objective: string): string;
export declare function ensureDir(dir: string): void;
export declare function readState(objDir: string): Record<string, unknown>;
export declare function writeState(objDir: string, state: Record<string, unknown>): void;
export declare function readTasks(objDir: string): Task[];
export declare function writeTasks(objDir: string, tasks: Task[]): void;
export declare function readNotes(objDir: string): Note[];
export declare function writeNotes(objDir: string, notes: Note[]): void;
export declare function readActiveSession(objDir: string): ActiveSession | null;
export declare function writeActiveSession(objDir: string, session: ActiveSession): void;
export declare function deleteActiveSession(objDir: string): void;
export declare function listSessions(objDir: string): SessionSummary[];
export declare function readSettings(root: string): SettingsData;
export declare function writeSettings(root: string, settings: SettingsData): void;
export declare function writeArtifact(path: string, content: string): void;
export declare function readArtifact(path: string): string;
export declare function listEpicFiles(objDir: string): {
    dir: string;
    files: string[];
};
export declare function findObjectives(root: string): Array<{
    lane: string;
    objective: string;
    dir: string;
}>;
/** All 6 v4 lane directories in order. */
export declare const V4_LANES: readonly ["0-backlog", "1-ready", "2-active", "3-review", "4-done", "5-archive"];
/**
 * Get the absolute path to an epic's directory within a lane.
 *
 * @param root - Project root (parent of .twisted/).
 * @param laneDir - Lane directory name (e.g. "2-active").
 * @param epicName - Epic name.
 */
export declare function epicDir(root: string, laneDir: string, epicName: string): string;
/**
 * Move an epic directory from one lane to another.
 * Safe on all platforms — uses renameSync (same filesystem assumed).
 *
 * @param root - Project root.
 * @param epicName - Epic name.
 * @param fromLane - Source lane directory name.
 * @param toLane - Target lane directory name.
 */
export declare function moveDir(root: string, epicName: string, fromLane: string, toLane: string): void;
/**
 * Scan all 6 v4 lane directories and return every epic found.
 *
 * An epic is any subdirectory containing a state.json file.
 *
 * @param root - Project root.
 */
export declare function findEpics(root: string): Array<{
    lane: string;
    epic: string;
    dir: string;
}>;
/**
 * Find which lane an epic currently lives in.
 *
 * @param root - Project root.
 * @param epicName - Epic name.
 * @returns Lane directory name and absolute epic path, or null if not found.
 */
export declare function locateEpic(root: string, epicName: string): {
    lane: string;
    dir: string;
} | null;
export declare function readCoreState(epicDirectory: string): CoreState;
export declare function writeCoreState(epicDirectory: string, state: CoreState): void;
import type { StoriesFile } from "../types/stories.js";
export declare function readStories(epicDirectory: string): StoriesFile | null;
export declare function writeStories(epicDirectory: string, stories: StoriesFile): void;
export {};
//# sourceMappingURL=fs.d.ts.map