// src/adapters/pglite/migrations.ts — sequential migration runner.
//
// Migrations are numbered SQL strings applied in ascending order.
// Applied migration IDs are tracked in `_migrations` so each migration
// runs exactly once across the lifetime of a database.
//
// Design: we use a plain INTEGER primary key (the migration number) rather
// than a hash or filename, so the ordering is unambiguous and deterministic.
import { SCHEMA_SQL } from './schema.js';
/** Ordered list of migrations. Index+1 = migration ID (1-based). */
const MIGRATIONS = [
    // Migration 1: full initial schema
    SCHEMA_SQL,
];
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;
/**
 * Apply any pending migrations to the given PGlite instance.
 *
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export async function runMigrations(db) {
    // Bootstrap the tracking table first (idempotent).
    await db.exec(BOOTSTRAP_SQL);
    // Determine which migrations have already been applied.
    const result = await db.query('SELECT id FROM _migrations ORDER BY id');
    const applied = new Set(result.rows.map((r) => r.id));
    for (let i = 0; i < MIGRATIONS.length; i++) {
        const migrationId = i + 1; // 1-based
        if (applied.has(migrationId))
            continue;
        const sql = MIGRATIONS[i];
        // Each migration runs in its own transaction for atomicity.
        // If the SQL throws, the transaction is rolled back and the error
        // propagates — leaving _migrations unchanged so the next startup
        // will retry this migration rather than silently skip it.
        await db.transaction(async (tx) => {
            await tx.exec(sql);
            await tx.query('INSERT INTO _migrations (id, applied_at) VALUES ($1, $2)', [migrationId, new Date().toISOString()]);
        });
    }
}
//# sourceMappingURL=migrations.js.map