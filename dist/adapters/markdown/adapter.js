// src/adapters/markdown/adapter.ts — MarkdownProjectionAdapter.
//
// Implements ProjectionPort by querying StoragePort for domain data and
// delegating all markdown generation to renderer.ts. Writes results to
// the filesystem under `basePath` (.twisted/).
//
// Design: DB is truth. Every render method queries fresh — there is no cache.
// The filesystem is strictly a read-only projection for human inspection and
// git commits.
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { renderIssue, renderCycle, renderSnapshot } from './renderer.js';
import { getCheckpoint } from '../../checkpoints/crud.js';
import { writeCheckpointFile } from '../../checkpoints/projection.js';
// ── Adapter ────────────────────────────────────────────────────
export class MarkdownProjectionAdapter {
    db;
    basePath;
    constructor(db, basePath) {
        this.db = db;
        this.basePath = basePath;
    }
    /**
     * Query issue + its notes + its tasks, render markdown, write to
     * `{basePath}/issues/{slug}.md`.
     *
     * Throws if the issue slug is not found — the projection layer should only
     * be called for issues that actually exist in the DB.
     */
    async renderIssue(issueSlug) {
        const issueResult = await this.db.query(`SELECT id, slug, title, body, type, workflow_id, step, status,
              parent_id, metadata, created_at, updated_at
       FROM issues WHERE slug = $1`, [issueSlug]);
        const issueRow = issueResult.rows[0];
        if (issueRow == null) {
            throw new Error(`renderIssue: issue not found — slug "${issueSlug}"`);
        }
        // Cast the raw DB row to Issue. metadata is JSONB — PGLite returns it as a
        // parsed JS object, which satisfies Record<string, Json> at runtime.
        // The type cast is safe because the schema enforces these columns.
        const issue = issueRow;
        const notesResult = await this.db.query(`SELECT id, summary, tag, created_at
       FROM notes WHERE issue_slug = $1 ORDER BY created_at ASC`, [issueSlug]);
        const tasksResult = await this.db.query(`SELECT id, summary, done, created_at
       FROM tasks WHERE issue_slug = $1 ORDER BY created_at ASC`, [issueSlug]);
        const notes = notesResult.rows.map((r) => ({
            id: r.id,
            summary: r.summary,
            tag: r.tag,
            created_at: r.created_at,
        }));
        const tasks = tasksResult.rows.map((r) => ({
            id: r.id,
            summary: r.summary,
            // PGLite stores `done` as INTEGER (0/1) — coerce to boolean.
            done: r.done !== 0,
            created_at: r.created_at,
        }));
        const markdown = renderIssue(issue, notes, tasks);
        const dir = join(this.basePath, 'issues');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${issueSlug}.md`), markdown, 'utf8');
    }
    /**
     * Query cycle + issue counts, render markdown, write to
     * `{basePath}/cycles/{slug}.md`.
     *
     * Throws if the cycle slug is not found.
     */
    async renderCycle(cycleSlug) {
        const cycleResult = await this.db.query(`SELECT id, slug, title, description, status, started_at, closed_at
       FROM cycles WHERE slug = $1`, [cycleSlug]);
        const cycleRow = cycleResult.rows[0];
        if (cycleRow == null) {
            throw new Error(`renderCycle: cycle not found — slug "${cycleSlug}"`);
        }
        const cycle = cycleRow;
        // Single query for both total and completed counts — avoids two round-trips.
        const countResult = await this.db.query(`SELECT
         COUNT(*)::int                                        AS total,
         COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed
       FROM cycle_issues WHERE cycle_id = $1`, [cycleRow.id]);
        // COUNT always returns at least one row — guard for noUncheckedIndexedAccess.
        const counts = countResult.rows[0];
        const issueCount = counts?.total ?? 0;
        const completedCount = counts?.completed ?? 0;
        const markdown = renderCycle(cycle, issueCount, completedCount);
        const dir = join(this.basePath, 'cycles');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${cycleSlug}.md`), markdown, 'utf8');
    }
    /**
     * Query a checkpoint by ID and write it to the filesystem.
     *
     * Delegates to `writeCheckpointFile` from src/checkpoints/projection.ts
     * which handles directory creation and the filename convention
     * (`{number}-{id_prefix}.md`).
     *
     * Throws if the checkpoint ID is not found.
     */
    async renderCheckpoint(checkpointId) {
        const checkpoint = await getCheckpoint(this.db, checkpointId);
        if (checkpoint == null) {
            throw new Error(`renderCheckpoint: checkpoint not found — id "${checkpointId}"`);
        }
        // writeCheckpointFile handles mkdir + writeFile internally.
        await writeCheckpointFile(checkpoint, this.basePath);
    }
    /**
     * Query all non-archived issues, render a snapshot table, write to
     * `{basePath}/snapshot.md`.
     *
     * Uses status != 'archived' rather than status = 'open' so that blocked
     * and done issues also appear — the snapshot is meant to be a full
     * current-state view, not just the open queue.
     */
    async renderSnapshot() {
        const result = await this.db.query(`SELECT id, slug, title, body, type, workflow_id, step, status,
              parent_id, metadata, created_at, updated_at
       FROM issues WHERE status != 'archived' ORDER BY created_at ASC`);
        const issues = result.rows;
        const markdown = renderSnapshot(issues);
        await mkdir(this.basePath, { recursive: true });
        await writeFile(join(this.basePath, 'snapshot.md'), markdown, 'utf8');
    }
    /**
     * Delete the filesystem artifact for an issue.
     *
     * Removes `{basePath}/issues/{slug}.md` if it exists. Does not throw if
     * the file is absent — the engine may call deleteIssue on an issue that
     * was never projected (e.g. created and immediately archived).
     */
    async deleteIssue(issueSlug) {
        const filePath = join(this.basePath, 'issues', `${issueSlug}.md`);
        try {
            await unlink(filePath);
        }
        catch (err) {
            // ENOENT means the file never existed — this is not an error condition.
            // Any other filesystem error (EPERM, EACCES, etc.) should propagate.
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    }
}
//# sourceMappingURL=adapter.js.map