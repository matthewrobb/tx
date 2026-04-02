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
/**
 * Path to the agents directory under the project's .claude folder.
 */
export declare function agentsDir(projectRoot: string): string;
/**
 * Create or update a symlink for an epic in .claude/agents/.
 *
 * If a symlink already exists and points to a different target, it is removed and recreated.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epicName - Name of the epic.
 * @param epicDir - Absolute path to the epic's current lane directory.
 */
export declare function createAgentSymlink(projectRoot: string, epicName: string, epicDir: string): void;
/**
 * Remove the agent symlink for an epic (called when it is archived or deleted).
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epicName - Name of the epic.
 */
export declare function removeAgentSymlink(projectRoot: string, epicName: string): void;
/**
 * Sync all agent symlinks for a list of epics.
 * Creates symlinks for active epics, removes any stale entries.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param epics - List of active epic name + dir pairs.
 */
export declare function syncAgentSymlinks(projectRoot: string, epics: Array<{
    epic: string;
    dir: string;
}>): void;
//# sourceMappingURL=generate.d.ts.map