/**
 * Agent generation — creates .claude/agents/ entries for each active epic.
 *
 * Each epic gets a subdirectory under .claude/agents/{epic-name}/ that is
 * a symlink to the epic's lane directory. This allows Claude Code agents
 * to reference epic-specific context (state, notes, tasks, stories) without
 * needing to know the current lane.
 *
 * Uses symlink-dir for cross-platform directory symlinks.
 */
import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { symlinkDirSync } from "symlink-dir";
/**
 * Path to the agents directory under the project's .claude folder.
 */
export function agentsDir(projectRoot) {
    return join(projectRoot, ".claude", "agents");
}
/**
 * Create or update a symlink for an epic in .claude/agents/.
 *
 * If a symlink already exists and points to a different target, it is removed and recreated.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epicName - Name of the epic.
 * @param epicDir - Absolute path to the epic's current lane directory.
 */
export function createAgentSymlink(projectRoot, epicName, epicDir) {
    const dir = agentsDir(projectRoot);
    mkdirSync(dir, { recursive: true });
    const target = join(dir, epicName);
    // Remove stale symlink if it exists
    if (existsSync(target)) {
        rmSync(target, { recursive: true, force: true });
    }
    symlinkDirSync(epicDir, target);
}
/**
 * Remove the agent symlink for an epic (called when it is archived or deleted).
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epicName - Name of the epic.
 */
export function removeAgentSymlink(projectRoot, epicName) {
    const target = join(agentsDir(projectRoot), epicName);
    if (existsSync(target)) {
        rmSync(target, { recursive: true, force: true });
    }
}
/**
 * Sync all agent symlinks for a list of epics.
 * Creates symlinks for active epics, removes any stale entries.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epics - List of active epic name + dir pairs.
 */
export function syncAgentSymlinks(projectRoot, epics) {
    const dir = agentsDir(projectRoot);
    mkdirSync(dir, { recursive: true });
    for (const { epic, dir: epicDir } of epics) {
        createAgentSymlink(projectRoot, epic, epicDir);
    }
}
//# sourceMappingURL=generate.js.map