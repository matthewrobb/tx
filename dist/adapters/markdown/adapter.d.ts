import type { ProjectionPort } from '../../ports/projection.js';
import type { StoragePort } from '../../ports/storage.js';
export declare class MarkdownProjectionAdapter implements ProjectionPort {
    private readonly db;
    private readonly basePath;
    constructor(db: StoragePort, basePath: string);
    /**
     * Query issue + its notes + its tasks, render markdown, write to
     * `{basePath}/issues/{slug}.md`.
     *
     * Throws if the issue slug is not found — the projection layer should only
     * be called for issues that actually exist in the DB.
     */
    renderIssue(issueSlug: string): Promise<void>;
    /**
     * Query cycle + issue counts, render markdown, write to
     * `{basePath}/cycles/{slug}.md`.
     *
     * Throws if the cycle slug is not found.
     */
    renderCycle(cycleSlug: string): Promise<void>;
    /**
     * Query a checkpoint by ID and write it to the filesystem.
     *
     * Delegates to `writeCheckpointFile` from src/checkpoints/projection.ts
     * which handles directory creation and the filename convention
     * (`{number}-{id_prefix}.md`).
     *
     * Throws if the checkpoint ID is not found.
     */
    renderCheckpoint(checkpointId: string): Promise<void>;
    /**
     * Query all non-archived issues, render a snapshot table, write to
     * `{basePath}/snapshot.md`.
     *
     * Uses status != 'archived' rather than status = 'open' so that blocked
     * and done issues also appear — the snapshot is meant to be a full
     * current-state view, not just the open queue.
     */
    renderSnapshot(): Promise<void>;
    /**
     * Delete the filesystem artifact for an issue.
     *
     * Removes `{basePath}/issues/{slug}.md` if it exists. Does not throw if
     * the file is absent — the engine may call deleteIssue on an issue that
     * was never projected (e.g. created and immediately archived).
     */
    deleteIssue(issueSlug: string): Promise<void>;
}
//# sourceMappingURL=adapter.d.ts.map