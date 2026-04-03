// src/issues/crud.ts — Create, read, update, close, and archive operations for Issue.
//
// Row → Issue mapping:
//   DB stores id as TEXT. At the read boundary we cast `id as IssueId` and
//   `parent_id as IssueId | null`. The caller's `createIssue` guarantees every
//   id is a crypto.randomUUID() value, so the cast is safe.
//
//   metadata arrives from PGLite as a parsed JS object (JSONB column) — we assert
//   it as `Record<string, Json>` since we write it that way and the schema enforces
//   DEFAULT '{}'.
import { randomUUID } from 'node:crypto';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { propagateDone } from './hierarchy.js';
/** Map a raw DB row to a typed Issue. */
function rowToIssue(row) {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        // Trust the DB — only valid IssueType values were ever written.
        type: row.type,
        workflow_id: row.workflow_id,
        step: row.step,
        // Trust the DB — only valid IssueStatus values were ever written.
        status: row.status,
        parent_id: row.parent_id !== null ? row.parent_id : null,
        // JSONB columns arrive as parsed JS objects from PGLite.
        // We wrote them as Record<string, Json> so the cast is safe.
        metadata: (row.metadata ?? {}),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Find the first step in a workflow — the step with an empty `needs` array.
 * Returns the step id string, or throws if the workflow is not found.
 */
function getInitialStep(workflowId) {
    const workflow = DEFAULT_CONFIG.workflows.find((w) => w.id === workflowId);
    if (workflow === undefined) {
        throw new Error(`Workflow not found: ${workflowId}`);
    }
    // The initial step has no dependencies. If multiple steps have empty needs
    // (parallel start), we take the first one in array order.
    const initial = workflow.steps?.find((s) => {
        const needs = s.needs;
        return needs === undefined || needs.length === 0;
    });
    if (initial === undefined) {
        throw new Error(`Workflow ${workflowId} has no step with empty needs`);
    }
    return initial.id;
}
// ── CRUD functions ─────────────────────────────────────────────────────────
/**
 * Create a new issue.
 *
 * Initial step is the first step of the workflow (the step with no `needs`).
 * Initial status is 'open'.
 */
export async function createIssue(db, input, tx) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const step = getInitialStep(input.workflow_id);
    const metadata = input.metadata ?? {};
    const result = await db.query(`INSERT INTO issues
       (id, slug, title, body, type, workflow_id, step, status, parent_id, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
     RETURNING *`, [
        id,
        input.slug,
        input.title,
        input.body ?? null,
        input.type,
        input.workflow_id,
        step,
        'open',
        input.parent_id ?? null,
        JSON.stringify(metadata),
        now,
        now,
    ], tx);
    const row = result.rows[0];
    if (row === undefined) {
        throw new Error('INSERT did not return a row');
    }
    return rowToIssue(row);
}
/** Get issue by ID. Returns null when not found. */
export async function getIssue(db, id, tx) {
    const result = await db.query(`SELECT * FROM issues WHERE id = $1`, [id], tx);
    const row = result.rows[0];
    return row !== undefined ? rowToIssue(row) : null;
}
/** Get issue by slug. Returns null when not found. */
export async function getIssueBySlug(db, slug, tx) {
    const result = await db.query(`SELECT * FROM issues WHERE slug = $1`, [slug], tx);
    const row = result.rows[0];
    return row !== undefined ? rowToIssue(row) : null;
}
/**
 * List issues with optional filters.
 *
 * Filters are applied as AND conditions. Passing `parent_id: null` filters
 * to top-level issues (parent_id IS NULL). Omitting `parent_id` returns all.
 */
export async function listIssues(db, opts, tx) {
    const clauses = [];
    const params = [];
    let paramIdx = 1;
    if (opts?.status !== undefined) {
        clauses.push(`status = $${paramIdx++}`);
        params.push(opts.status);
    }
    if (opts?.type !== undefined) {
        clauses.push(`type = $${paramIdx++}`);
        params.push(opts.type);
    }
    if (opts?.workflow_id !== undefined) {
        clauses.push(`workflow_id = $${paramIdx++}`);
        params.push(opts.workflow_id);
    }
    // parent_id filter: null means explicitly filtering for top-level issues
    // (parent_id IS NULL). The `in opts` check distinguishes omitted vs null.
    if (opts !== undefined && 'parent_id' in opts) {
        if (opts.parent_id === null) {
            clauses.push('parent_id IS NULL');
        }
        else {
            clauses.push(`parent_id = $${paramIdx++}`);
            params.push(opts.parent_id);
        }
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM issues ${where} ORDER BY created_at ASC`;
    const result = await db.query(sql, params, tx);
    return result.rows.map(rowToIssue);
}
/**
 * Update issue fields. Only provided fields are changed; updated_at is always set.
 * Throws when the issue does not exist.
 */
export async function updateIssue(db, id, update, tx) {
    const setClauses = [];
    const params = [];
    let paramIdx = 1;
    if (update.title !== undefined) {
        setClauses.push(`title = $${paramIdx++}`);
        params.push(update.title);
    }
    if (update.body !== undefined) {
        setClauses.push(`body = $${paramIdx++}`);
        params.push(update.body);
    }
    if (update.step !== undefined) {
        setClauses.push(`step = $${paramIdx++}`);
        params.push(update.step);
    }
    if (update.status !== undefined) {
        setClauses.push(`status = $${paramIdx++}`);
        params.push(update.status);
    }
    if (update.workflow_id !== undefined) {
        setClauses.push(`workflow_id = $${paramIdx++}`);
        params.push(update.workflow_id);
    }
    if (update.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIdx++}::jsonb`);
        params.push(JSON.stringify(update.metadata));
    }
    // updated_at is always refreshed
    const now = new Date().toISOString();
    setClauses.push(`updated_at = $${paramIdx++}`);
    params.push(now);
    if (setClauses.length === 1) {
        // Only updated_at was added — still valid; proceed so callers can use
        // updateIssue as a "touch" operation.
    }
    // WHERE id = $N
    params.push(id);
    const sql = `UPDATE issues SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await db.query(sql, params, tx);
    const row = result.rows[0];
    if (row === undefined) {
        throw new Error(`Issue not found: ${id}`);
    }
    return rowToIssue(row);
}
/**
 * Close an issue: set status to 'done'.
 * After closing, checks whether the parent should also be auto-closed.
 * Throws when the issue with the given slug does not exist.
 */
export async function closeIssue(db, slug, tx) {
    const existing = await getIssueBySlug(db, slug, tx);
    if (existing === null) {
        throw new Error(`Issue not found: ${slug}`);
    }
    const closed = await updateIssue(db, existing.id, { status: 'done' }, tx);
    // Propagate done upward through the parent chain.
    await propagateDone(db, closed, tx);
    return closed;
}
/**
 * Archive an issue: set status to 'archived'.
 * Throws when the issue with the given slug does not exist.
 */
export async function archiveIssue(db, slug, tx) {
    const existing = await getIssueBySlug(db, slug, tx);
    if (existing === null) {
        throw new Error(`Issue not found: ${slug}`);
    }
    return updateIssue(db, existing.id, { status: 'archived' }, tx);
}
//# sourceMappingURL=crud.js.map