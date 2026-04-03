// src/daemon/handlers.ts — Command handler functions for the daemon.
//
// Each handler takes the StoragePort (and optionally ProjectionPort) plus a
// narrowed DaemonRequest, executes the operation, and returns a DaemonResponse.
//
// The daemon dispatches to these handlers based on `req.command`. Handlers do
// NOT call projection directly — they return the response and the daemon marks
// dirty slugs via the ProjectionFlusher.
//
// E2E tests for the full daemon (socket + PGLite) are covered by S-027.
import { txNext } from '../engine/state.js';
import { createIssue, listIssues, getIssueBySlug, closeIssue } from '../issues/crud.js';
import { createCheckpoint } from '../checkpoints/crud.js';
import { startCycle, pullIssues, closeCycle } from '../cycles/lifecycle.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
// ── Helpers ───────────────────────────────────────────────────────────────
/**
 * Find the workflow id that is the default for a given issue type.
 * Falls back to the type string itself (convention: workflow id matches type).
 */
function resolveWorkflowId(issueType) {
    const workflow = DEFAULT_CONFIG.workflows.find((w) => w.default_for?.includes(issueType));
    return workflow?.id ?? issueType;
}
// ── Handlers ──────────────────────────────────────────────────────────────
export async function handleNext(db, projection, req) {
    // txNext runs the full engine loop: evaluate conditions, advance step, persist.
    // Projection is handled inside txNext (after transaction commit).
    const result = await txNext(db, projection, { issue_slug: req.issue_slug });
    if (result.status === 'error') {
        return { status: 'error', message: result.message };
    }
    if (result.status === 'paused') {
        return { status: 'paused', prompt: result.action };
    }
    return { status: 'ok', data: result };
}
export async function handleStatus(db, req) {
    if (req.issue_slug !== undefined) {
        const issue = await getIssueBySlug(db, req.issue_slug);
        if (issue === null) {
            return { status: 'error', message: `Issue not found: ${req.issue_slug}` };
        }
        return { status: 'ok', data: issue };
    }
    // No slug — list all non-archived issues.
    const issues = await listIssues(db);
    return { status: 'ok', data: issues };
}
export async function handleOpen(db, _projection, req) {
    const workflowId = resolveWorkflowId(req.type);
    const issue = await createIssue(db, {
        slug: req.slug,
        title: req.title ?? req.slug,
        type: req.type,
        workflow_id: workflowId,
    });
    return { status: 'ok', data: issue };
}
export async function handleClose(db, _projection, req) {
    try {
        const issue = await closeIssue(db, req.issue_slug);
        return { status: 'ok', data: issue };
    }
    catch (err) {
        return { status: 'error', message: err.message };
    }
}
export async function handleWrite(db, req) {
    // Store artifact content in the vars table, keyed by type.
    // The issue's current step is used as the step scope.
    const issue = await getIssueBySlug(db, req.issue_slug);
    if (issue === null) {
        return { status: 'error', message: `Issue not found: ${req.issue_slug}` };
    }
    await db.query(`INSERT INTO vars (issue_slug, step, key, value)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (issue_slug, step, key) DO UPDATE SET value = EXCLUDED.value`, [req.issue_slug, issue.step, req.type, JSON.stringify(req.content)]);
    return { status: 'ok', data: { written: req.type, issue_slug: req.issue_slug } };
}
export async function handleRead(db, req) {
    const issue = await getIssueBySlug(db, req.issue_slug);
    if (issue === null) {
        return { status: 'error', message: `Issue not found: ${req.issue_slug}` };
    }
    const result = await db.query(`SELECT key, value FROM vars WHERE issue_slug = $1 AND step = $2 AND key = $3`, [req.issue_slug, issue.step, req.type]);
    const row = result.rows[0];
    if (row === undefined) {
        return { status: 'error', message: `Artifact not found: ${req.type} for ${req.issue_slug}` };
    }
    return { status: 'ok', data: { type: req.type, content: row.value } };
}
export async function handleNote(db, req) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Notes support multiple tags — store the first tag in the tag column.
    // Decision: single tag column per note; if multiple tags are needed in the
    // future, a junction table is the correct approach.
    const tag = req.tags[0] ?? 'discover';
    await db.query(`INSERT INTO notes (id, summary, tag, issue_slug, created_at)
     VALUES ($1, $2, $3, $4, $5)`, [id, req.summary, tag, req.issue_slug ?? null, now]);
    return { status: 'ok', data: { id, tag, summary: req.summary } };
}
export async function handlePickup(db, req) {
    // Session tracking via vars table under a special '__session' issue_slug and
    // '__global' step — avoids adding a separate sessions table.
    const now = new Date().toISOString();
    const sessionData = JSON.stringify({
        name: req.name ?? null,
        started: now,
        active: true,
    });
    await db.query(`INSERT INTO vars (issue_slug, step, key, value)
     VALUES ('__session', '__global', 'active', $1::jsonb)
     ON CONFLICT (issue_slug, step, key) DO UPDATE SET value = EXCLUDED.value`, [sessionData]);
    return { status: 'ok', data: { session: { name: req.name ?? null, started: now } } };
}
export async function handleHandoff(db, _req) {
    const now = new Date().toISOString();
    const sessionData = JSON.stringify({
        name: null,
        ended: now,
        active: false,
    });
    await db.query(`INSERT INTO vars (issue_slug, step, key, value)
     VALUES ('__session', '__global', 'active', $1::jsonb)
     ON CONFLICT (issue_slug, step, key) DO UPDATE SET value = EXCLUDED.value`, [sessionData]);
    return { status: 'ok', data: { ended: now } };
}
export async function handleCheckpoint(db, req) {
    const checkpoint = await createCheckpoint(db, {
        summary: req.summary,
        // Checkpoint content is the summary itself — the full content is written
        // by the agent after creation. This keeps the handler thin.
        content: req.summary,
    });
    return { status: 'ok', data: checkpoint };
}
// ── Cycle handlers ───────────────────────────────────────────────────────
export async function handleCycleStart(db, req) {
    try {
        const cycle = await startCycle(db, {
            slug: req.slug,
            title: req.title,
            description: req.description,
        });
        return { status: 'ok', data: cycle };
    }
    catch (err) {
        return { status: 'error', message: err.message };
    }
}
export async function handleCyclePull(db, req) {
    const result = await db.query("SELECT slug FROM cycles WHERE status = 'active' LIMIT 1", []);
    const row = result.rows[0];
    if (row === undefined) {
        return { status: 'error', message: 'No active cycle. Start one with cycle_start first.' };
    }
    try {
        const pullResult = await pullIssues(db, row.slug, req.issue_slugs);
        return { status: 'ok', data: pullResult };
    }
    catch (err) {
        return { status: 'error', message: err.message };
    }
}
export async function handleCycleClose(db, req) {
    const result = await db.query("SELECT slug FROM cycles WHERE status = 'active' LIMIT 1", []);
    const row = result.rows[0];
    if (row === undefined) {
        return { status: 'error', message: 'No active cycle to close.' };
    }
    try {
        const closeResult = await closeCycle(db, {
            cycleSlug: row.slug,
            summary: req.summary,
        });
        return { status: 'ok', data: closeResult };
    }
    catch (err) {
        return { status: 'error', message: err.message };
    }
}
//# sourceMappingURL=handlers.js.map