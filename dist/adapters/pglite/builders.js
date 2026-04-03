// src/adapters/pglite/builders.ts — JSONB query helper functions.
//
// These helpers encapsulate the PGlite/Postgres JSONB operator syntax so
// call sites stay readable and the SQL is generated consistently.
//
// All helpers return plain strings or `{ sql, params }` objects — they never
// execute queries themselves, so they're pure and easily unit-tested.
/**
 * Returns a SQL expression for extracting a top-level JSONB key as TEXT.
 *
 * Uses the `->>` operator (text extraction) rather than `->` (JSON extraction)
 * because the vast majority of lookups want a plain string for comparison.
 *
 * Example: `jsonbGet('metadata', 'owner')` → `"metadata"->>'owner'`
 */
export function jsonbGet(column, key) {
    // Double-quote the column to preserve case; single-quote the key because
    // it's a JSON object key, not an identifier.
    return `"${column}"->>'${key}'`;
}
/**
 * Returns SQL + params for updating a single top-level key in a JSONB column.
 *
 * Uses `jsonb_set` with `create_missing = true` (default) so the key is
 * created if it doesn't exist yet.
 *
 * Example:
 *   `jsonbSet('metadata', 'priority', 'high')`
 *   → { sql: "jsonb_set(\"metadata\", '{priority}', $1::jsonb)", params: ['"high"'] }
 *
 * NOTE: The value is serialized to JSON and cast to `::jsonb` so Postgres
 * stores it with the correct JSONB type rather than as a string literal.
 */
export function jsonbSet(column, key, value) {
    return {
        sql: `jsonb_set("${column}", '{${key}}', $1::jsonb)`,
        // Serialize to a JSON string — Postgres will parse it back to JSONB.
        params: [JSON.stringify(value)],
    };
}
/**
 * Returns SQL + params for a JSONB containment check (`@>`).
 *
 * `column @> value` is true when `column` contains all key-value pairs
 * in `value`. Useful for filtering rows by partial metadata matches.
 *
 * Example:
 *   `jsonbContains('metadata', { status: 'open' })`
 *   → { sql: `"metadata" @> $1::jsonb`, params: ['{"status":"open"}'] }
 */
export function jsonbContains(column, value) {
    return {
        sql: `"${column}" @> $1::jsonb`,
        params: [JSON.stringify(value)],
    };
}
//# sourceMappingURL=builders.js.map