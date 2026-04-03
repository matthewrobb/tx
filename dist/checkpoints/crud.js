// src/checkpoints/crud.ts — Create, get, and list checkpoints.
//
// Checkpoints are context bridges between LLM sessions. Each checkpoint is
// assigned a sequential number within the project (1, 2, 3...) so humans and
// agents can reference them by position without knowing UUIDs.
//
// All operations depend on StoragePort — the PGLite adapter is injected by
// the caller. This file has no direct dependency on PGLite or any filesystem.
function fromRow(row) {
    return {
        id: row.id,
        number: row.number,
        issue_slug: row.issue_slug,
        summary: row.summary,
        content: row.content,
        created_at: row.created_at,
    };
}
// ── CRUD operations ────────────────────────────────────────────
/**
 * Create a new checkpoint. Auto-assigns the next sequential number by
 * selecting MAX(number) + 1. This is safe under PGLite's single-connection
 * serialized mutex — there is no concurrent writer race.
 */
export async function createCheckpoint(db, input, tx) {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const issue_slug = input.issue_slug ?? null;
    // Determine next number atomically — MAX(number) + 1, defaulting to 1.
    const maxResult = await db.query('SELECT MAX(number) AS max_num FROM checkpoints', [], tx);
    // noUncheckedIndexedAccess means rows[0] is possibly undefined — guard it.
    const maxRow = maxResult.rows[0];
    const number = maxRow != null && maxRow.max_num != null ? maxRow.max_num + 1 : 1;
    await db.query(`INSERT INTO checkpoints (id, number, issue_slug, summary, content, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`, [id, number, issue_slug, input.summary, input.content, created_at], tx);
    return { id, number, issue_slug, summary: input.summary, content: input.content, created_at };
}
/**
 * Get a checkpoint by its UUID. Returns null when the ID is not found
 * rather than throwing — callers that require existence should check the
 * return value explicitly.
 */
export async function getCheckpoint(db, id, tx) {
    const result = await db.query('SELECT id, number, issue_slug, summary, content, created_at FROM checkpoints WHERE id = $1', [id], tx);
    const row = result.rows[0];
    return row != null ? fromRow(row) : null;
}
/**
 * Get the most recent checkpoint (highest number), optionally filtered to
 * a specific issue. Returns null when no checkpoints exist.
 */
export async function getLatestCheckpoint(db, issue_slug, tx) {
    let sql;
    let params;
    if (issue_slug != null) {
        sql =
            'SELECT id, number, issue_slug, summary, content, created_at FROM checkpoints WHERE issue_slug = $1 ORDER BY number DESC LIMIT 1';
        params = [issue_slug];
    }
    else {
        sql =
            'SELECT id, number, issue_slug, summary, content, created_at FROM checkpoints ORDER BY number DESC LIMIT 1';
        params = [];
    }
    const result = await db.query(sql, params, tx);
    const row = result.rows[0];
    return row != null ? fromRow(row) : null;
}
/**
 * List all checkpoints ordered by number DESC (most recent first),
 * optionally filtered to a specific issue_slug.
 */
export async function listCheckpoints(db, issue_slug, tx) {
    let sql;
    let params;
    if (issue_slug != null) {
        sql =
            'SELECT id, number, issue_slug, summary, content, created_at FROM checkpoints WHERE issue_slug = $1 ORDER BY number DESC';
        params = [issue_slug];
    }
    else {
        sql =
            'SELECT id, number, issue_slug, summary, content, created_at FROM checkpoints ORDER BY number DESC';
        params = [];
    }
    const result = await db.query(sql, params, tx);
    return result.rows.map(fromRow);
}
//# sourceMappingURL=crud.js.map