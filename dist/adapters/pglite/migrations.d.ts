import type { PGlite } from '@electric-sql/pglite';
/**
 * Apply any pending migrations to the given PGlite instance.
 *
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export declare function runMigrations(db: PGlite): Promise<void>;
//# sourceMappingURL=migrations.d.ts.map