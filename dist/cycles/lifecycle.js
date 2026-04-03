// src/cycles/lifecycle.ts — startCycle(), pullIssues(), closeCycle().
//
// All mutations run through StoragePort. closeCycle() uses a single
// transaction to keep the close operation atomic: updating cycle_issues,
// creating the checkpoint, and flipping the cycle status all commit together
// or none of them do.
import { randomUUID } from 'node:crypto';
import { listIssues } from '../issues/crud.js';
import { createCheckpoint } from '../checkpoints/crud.js';
import { generateRetro } from './retro.js';
function rowToCycle(row) {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        // Trust the DB — only valid CycleStatus values were ever written.
        status: row.status,
        started_at: row.started_at,
        closed_at: row.closed_at,
    };
}
function joinRowToIssue(row) {
    return {
        id: row.issue_id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        type: row.type,
        workflow_id: row.workflow_id,
        step: row.step,
        status: row.issue_status,
        parent_id: row.parent_id !== null ? row.parent_id : null,
        // JSONB columns arrive as parsed objects from PGLite.
        // We wrote them as Record<string, Json>, so the cast is safe.
        metadata: (row.metadata ?? {}),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
/** Load a cycle by slug. Returns null when not found. */
async function getCycleBySlug(db, slug, tx) {
    const result = await db.query('SELECT * FROM cycles WHERE slug = $1', [slug], tx);
    const row = result.rows[0];
    return row !== undefined ? rowToCycle(row) : null;
}
// ── startCycle ─────────────────────────────────────────────────────────────
/**
 * Start a new cycle.
 *
 * Enforces a single-active-cycle invariant: errors if any cycle with
 * status = 'active' already exists.
 */
export async function startCycle(db, input) {
    // Guard: only one active cycle at a time.
    const activeCheck = await db.query("SELECT id FROM cycles WHERE status = 'active' LIMIT 1", []);
    if ((activeCheck.rows[0]) !== undefined) {
        throw new Error('A cycle is already active. Close it before starting a new one.');
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const result = await db.query(`INSERT INTO cycles (id, slug, title, description, status, started_at, closed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`, [
        id,
        input.slug,
        input.title,
        input.description ?? null,
        'active',
        now,
        null,
    ]);
    const row = result.rows[0];
    if (row === undefined) {
        throw new Error('INSERT did not return a row');
    }
    return rowToCycle(row);
}
// ── pullIssues ─────────────────────────────────────────────────────────────
/**
 * Pull issues into an active cycle.
 *
 * When `issueSlugs` is empty, auto-pulls all open issues not already in the
 * cycle. Issues already in the cycle or with status 'done' go to `skipped`.
 */
export async function pullIssues(db, cycleSlug, issueSlugs) {
    const cycle = await getCycleBySlug(db, cycleSlug);
    if (cycle === null) {
        throw new Error(`Cycle not found: ${cycleSlug}`);
    }
    if (cycle.status !== 'active') {
        throw new Error(`Cycle '${cycleSlug}' is not active (status: ${cycle.status})`);
    }
    // Load the full set of issues already in this cycle.
    const existingRows = await db.query('SELECT issue_id FROM cycle_issues WHERE cycle_id = $1', [cycle.id]);
    const alreadyInCycle = new Set(existingRows.rows.map((r) => r.issue_id));
    // Determine candidate issues.
    let candidates;
    if (issueSlugs.length === 0) {
        // Auto-pull: all open issues not already in this cycle.
        candidates = await listIssues(db, { status: 'open' });
    }
    else {
        // Explicit slugs: load each one by slug.
        const results = await Promise.all(issueSlugs.map((slug) => db.query('SELECT * FROM issues WHERE slug = $1', [slug])));
        candidates = results.flatMap((r) => r.rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            body: row.body,
            type: row.type,
            workflow_id: row.workflow_id,
            step: row.step,
            status: row.status,
            parent_id: row.parent_id !== null ? row.parent_id : null,
            metadata: (row.metadata ?? {}),
            created_at: row.created_at,
            updated_at: row.updated_at,
        })));
        // Error when a requested slug was not found in the DB.
        const foundSlugs = new Set(candidates.map((i) => i.slug));
        for (const slug of issueSlugs) {
            if (!foundSlugs.has(slug)) {
                throw new Error(`Issue not found: ${slug}`);
            }
        }
    }
    const pulled = [];
    const skipped = [];
    const now = new Date().toISOString();
    for (const issue of candidates) {
        // Skip if already in cycle or already done.
        if (alreadyInCycle.has(issue.id) || issue.status === 'done') {
            skipped.push(issue);
            continue;
        }
        await db.query(`INSERT INTO cycle_issues (cycle_id, issue_id, pulled_at, completed_at)
       VALUES ($1, $2, $3, $4)`, [cycle.id, issue.id, now, null]);
        pulled.push(issue);
    }
    return { cycle, pulled, skipped };
}
// ── closeCycle ─────────────────────────────────────────────────────────────
/**
 * Close an active cycle.
 *
 * All mutations run inside a single transaction:
 * 1. Load cycle and validate it's active.
 * 2. Load all cycle_issues with issue data via join.
 * 3. Mark completed issues (issue.status === 'done') with completed_at = now.
 * 4. Generate markdown retro via generateRetro().
 * 5. Create a checkpoint with the retro as content.
 * 6. Update cycle status to 'closed' and set closed_at.
 */
export async function closeCycle(db, input) {
    return db.transaction(async (tx) => {
        // 1. Load and validate cycle.
        const cycle = await getCycleBySlug(db, input.cycleSlug, tx);
        if (cycle === null) {
            throw new Error(`Cycle not found: ${input.cycleSlug}`);
        }
        if (cycle.status !== 'active') {
            throw new Error(`Cycle '${input.cycleSlug}' is not active (status: ${cycle.status})`);
        }
        // 2. Load all cycle_issues joined with issue data.
        //    Alias issue.status as issue_status to avoid collision with the
        //    cycle_issues columns if they ever gain a status column.
        const joinResult = await db.query(`SELECT
         ci.cycle_id,
         ci.issue_id,
         ci.pulled_at,
         ci.completed_at,
         i.slug,
         i.title,
         i.body,
         i.type,
         i.workflow_id,
         i.step,
         i.status AS issue_status,
         i.parent_id,
         i.metadata,
         i.created_at,
         i.updated_at
       FROM cycle_issues ci
       JOIN issues i ON i.id = ci.issue_id
       WHERE ci.cycle_id = $1`, [cycle.id], tx);
        const joinRows = joinResult.rows;
        const now = new Date().toISOString();
        // 3. Mark completed issues with completed_at and split into buckets.
        const completedIssues = [];
        const carriedOverIssues = [];
        for (const row of joinRows) {
            const issue = joinRowToIssue(row);
            if (issue.status === 'done') {
                // Update completed_at on the join record.
                await db.query(`UPDATE cycle_issues
           SET completed_at = $1
           WHERE cycle_id = $2 AND issue_id = $3`, [now, cycle.id, issue.id], tx);
                completedIssues.push(issue);
            }
            else {
                carriedOverIssues.push(issue);
            }
        }
        // 4. Generate retro markdown. closed_at is set to now for the period line.
        const closedCycle = { ...cycle, closed_at: now };
        const retroMarkdown = generateRetro({
            cycle: closedCycle,
            completed: completedIssues,
            carried_over: carriedOverIssues,
            summary: input.summary,
        });
        // 5. Create checkpoint with retro as content.
        const checkpoint = await createCheckpoint(db, {
            summary: `Retro: ${cycle.title}`,
            content: retroMarkdown,
        }, tx);
        // 6. Update cycle to closed.
        const closeResult = await db.query(`UPDATE cycles
       SET status = $1, closed_at = $2
       WHERE id = $3
       RETURNING *`, ['closed', now, cycle.id], tx);
        const closedRow = closeResult.rows[0];
        if (closedRow === undefined) {
            throw new Error('UPDATE cycles did not return a row');
        }
        // The cycle_issues and checkpoint inserts used the tx handle, so they
        // are committed atomically with the cycle status update.
        void {}; // keep import used — CycleIssue is structural documentation
        return {
            cycle: rowToCycle(closedRow),
            retro: retroMarkdown,
            checkpointId: checkpoint.id,
            completed: completedIssues.length,
            carried_over: carriedOverIssues.length,
        };
    });
}
//# sourceMappingURL=lifecycle.js.map