// src/cli/fs.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, renameSync } from "fs";
import { join, dirname } from "path";
export function findRoot(cwd) {
    return process.env.TWISTED_ROOT ?? cwd;
}
export function twistedDir(root) {
    return join(root, ".twisted");
}
export function objectiveDir(root, lane, objective) {
    return join(twistedDir(root), lane, objective);
}
export function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}
// --- State ---
export function readState(objDir) {
    return JSON.parse(readFileSync(join(objDir, "state.json"), "utf-8"));
}
export function writeState(objDir, state) {
    writeFileSync(join(objDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}
// --- Tasks ---
export function readTasks(objDir) {
    const path = join(objDir, "tasks.json");
    if (!existsSync(path))
        return [];
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function writeTasks(objDir, tasks) {
    writeFileSync(join(objDir, "tasks.json"), JSON.stringify(tasks, null, 2) + "\n");
}
// --- Notes ---
export function readNotes(objDir) {
    const path = join(objDir, "notes.json");
    if (!existsSync(path))
        return [];
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function writeNotes(objDir, notes) {
    writeFileSync(join(objDir, "notes.json"), JSON.stringify(notes, null, 2) + "\n");
}
// --- Sessions ---
export function readActiveSession(objDir) {
    const path = join(objDir, "sessions/active.json");
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function writeActiveSession(objDir, session) {
    const dir = join(objDir, "sessions");
    ensureDir(dir);
    writeFileSync(join(dir, "active.json"), JSON.stringify(session, null, 2) + "\n");
}
export function deleteActiveSession(objDir) {
    const path = join(objDir, "sessions/active.json");
    if (existsSync(path)) {
        unlinkSync(path);
    }
}
export function listSessions(objDir) {
    const dir = join(objDir, "sessions");
    if (!existsSync(dir))
        return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => {
        const match = f.match(/^(\d+)-(.+)\.md$/);
        if (!match)
            return null;
        return { number: parseInt(match[1], 10), name: match[2], file: f };
    })
        .filter((s) => s !== null);
}
// --- Settings ---
export function readSettings(root) {
    const path = join(twistedDir(root), "settings.json");
    if (!existsSync(path))
        return {};
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function writeSettings(root, settings) {
    const path = join(twistedDir(root), "settings.json");
    ensureDir(dirname(path));
    writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}
// --- Artifacts ---
export function writeArtifact(path, content) {
    ensureDir(dirname(path));
    writeFileSync(path, content);
}
export function readArtifact(path) {
    return readFileSync(path, "utf-8");
}
// --- File listing ---
export function listEpicFiles(objDir) {
    const dir = objDir.replace(/\\/g, "/");
    const entries = readdirSync(objDir, { recursive: true });
    const files = entries.map((f) => join(objDir, f).replace(/\\/g, "/"));
    return { dir, files };
}
// --- Scanning (v3) ---
export function findObjectives(root) {
    const twisted = twistedDir(root);
    const results = [];
    for (const lane of ["todo", "in-progress", "done"]) {
        const laneDir = join(twisted, lane);
        if (!existsSync(laneDir))
            continue;
        for (const entry of readdirSync(laneDir)) {
            const objDir = join(laneDir, entry);
            if (existsSync(join(objDir, "state.json"))) {
                results.push({ lane, objective: entry, dir: objDir });
            }
        }
    }
    return results;
}
// --- v4 Lane Model ---
/** All 6 v4 lane directories in order. */
export const V4_LANES = [
    "0-backlog",
    "1-ready",
    "2-active",
    "3-review",
    "4-done",
    "5-archive",
];
/**
 * Get the absolute path to an epic's directory within a lane.
 *
 * @param root - Project root (parent of .twisted/).
 * @param laneDir - Lane directory name (e.g. "2-active").
 * @param epicName - Epic name.
 */
export function epicDir(root, laneDir, epicName) {
    return join(twistedDir(root), laneDir, epicName);
}
/**
 * Move an epic directory from one lane to another.
 * Safe on all platforms — uses renameSync (same filesystem assumed).
 *
 * @param root - Project root.
 * @param epicName - Epic name.
 * @param fromLane - Source lane directory name.
 * @param toLane - Target lane directory name.
 */
export function moveDir(root, epicName, fromLane, toLane) {
    const source = epicDir(root, fromLane, epicName);
    const target = epicDir(root, toLane, epicName);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(source, target);
}
/**
 * Scan all 6 v4 lane directories and return every epic found.
 *
 * An epic is any subdirectory containing a state.json file.
 *
 * @param root - Project root.
 */
export function findEpics(root) {
    const twisted = twistedDir(root);
    const results = [];
    for (const lane of V4_LANES) {
        const laneDir = join(twisted, lane);
        if (!existsSync(laneDir))
            continue;
        for (const entry of readdirSync(laneDir)) {
            const dir = join(laneDir, entry);
            if (existsSync(join(dir, "state.json"))) {
                results.push({ lane, epic: entry, dir });
            }
        }
    }
    return results;
}
/**
 * Find which lane an epic currently lives in.
 *
 * @param root - Project root.
 * @param epicName - Epic name.
 * @returns Lane directory name and absolute epic path, or null if not found.
 */
export function locateEpic(root, epicName) {
    // Search v4 lanes first
    for (const lane of V4_LANES) {
        const dir = epicDir(root, lane, epicName);
        if (existsSync(join(dir, "state.json"))) {
            return { lane, dir };
        }
    }
    // Fall back to v3 lanes (todo, in-progress, done)
    for (const lane of ["todo", "in-progress", "done"]) {
        const dir = join(twistedDir(root), lane, epicName);
        if (existsSync(join(dir, "state.json"))) {
            return { lane, dir };
        }
    }
    return null;
}
// --- v4 CoreState ---
export function readCoreState(epicDirectory) {
    return JSON.parse(readFileSync(join(epicDirectory, "state.json"), "utf-8"));
}
export function writeCoreState(epicDirectory, state) {
    writeFileSync(join(epicDirectory, "state.json"), JSON.stringify(state, null, 2) + "\n");
}
export function readStories(epicDirectory) {
    const path = join(epicDirectory, "stories.json");
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function writeStories(epicDirectory, stories) {
    writeFileSync(join(epicDirectory, "stories.json"), JSON.stringify(stories, null, 2) + "\n");
}
//# sourceMappingURL=fs.js.map