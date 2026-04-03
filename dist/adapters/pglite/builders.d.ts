/**
 * Returns a SQL expression for extracting a top-level JSONB key as TEXT.
 *
 * Uses the `->>` operator (text extraction) rather than `->` (JSON extraction)
 * because the vast majority of lookups want a plain string for comparison.
 *
 * Example: `jsonbGet('metadata', 'owner')` → `"metadata"->>'owner'`
 */
export declare function jsonbGet(column: string, key: string): string;
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
export declare function jsonbSet(column: string, key: string, value: unknown): {
    sql: string;
    params: unknown[];
};
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
export declare function jsonbContains(column: string, value: Record<string, unknown>): {
    sql: string;
    params: unknown[];
};
//# sourceMappingURL=builders.d.ts.map