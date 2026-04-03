// src/adapters/pglite/adapter.ts — PGLiteStorageAdapter implementing StoragePort.
//
// PGLite uses a single WASM Postgres instance with an internal mutex:
// concurrent calls queue automatically — there is no connection pool and no
// acquire/release lifecycle to manage.
//
// StorageTx wraps PGLite's Transaction interface. The `closed` getter is
// read from the underlying PGLite Transaction, which sets it after rollback
// or commit. We do NOT shield callers from querying on a closed transaction —
// PGLite will throw, which is the correct behavior.
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from './migrations.js';
// ── StorageTx adapter ─────────────────────────────────────────────────────
/**
 * Wraps a PGLite Transaction to satisfy the StorageTx interface.
 *
 * PGLite's Transaction already has `query`, `exec`, `rollback`, and `closed`
 * — the only work here is narrowing the return types to match our StoragePort
 * shape (ReadonlyArray fields, typed rows).
 */
class PGLiteStorageTx {
    tx;
    constructor(tx) {
        this.tx = tx;
    }
    async query(sql, params) {
        const result = await this.tx.query(sql, params);
        return {
            rows: result.rows,
            affectedRows: result.affectedRows,
            fields: result.fields,
        };
    }
    async exec(sql) {
        const results = await this.tx.exec(sql);
        return results.map((r) => ({
            rows: r.rows,
            affectedRows: r.affectedRows,
            fields: r.fields,
        }));
    }
    rollback() {
        return this.tx.rollback();
    }
    get closed() {
        return this.tx.closed;
    }
}
// ── Adapter ───────────────────────────────────────────────────────────────
export class PGLiteStorageAdapter {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Execute a parameterized query.
     *
     * When `tx` is provided, the query runs inside that transaction.
     * When omitted, it runs against the root connection (auto-committed).
     */
    async query(sql, params, tx) {
        if (tx !== undefined) {
            // Delegate to the tx handle — it already wraps the PGLite Transaction.
            return tx.query(sql, params);
        }
        const result = await this.db.query(sql, params);
        return {
            rows: result.rows,
            affectedRows: result.affectedRows,
            fields: result.fields,
        };
    }
    /**
     * Execute raw SQL (DDL, multi-statement, migrations).
     *
     * When `tx` is provided, the statements run inside that transaction.
     */
    async exec(sql, tx) {
        if (tx !== undefined) {
            return tx.exec(sql);
        }
        const results = await this.db.exec(sql);
        return results.map((r) => ({
            rows: r.rows,
            affectedRows: r.affectedRows,
            fields: r.fields,
        }));
    }
    /**
     * Run a callback inside a transaction.
     *
     * PGLite handles auto-commit on resolve and auto-rollback on reject.
     * We wrap the native PGLite Transaction in PGLiteStorageTx so callers
     * can thread it through nested `query()`/`exec()` calls.
     */
    transaction(callback) {
        return this.db.transaction((pgTx) => {
            const tx = new PGLiteStorageTx(pgTx);
            return callback(tx);
        });
    }
}
// ── Factories ─────────────────────────────────────────────────────────────
/**
 * Create a persistent storage adapter backed by a directory on disk.
 *
 * Runs migrations before returning so the schema is always up to date.
 */
export async function createStorageAdapter(dataDir) {
    const db = await PGlite.create(dataDir);
    await runMigrations(db);
    return new PGLiteStorageAdapter(db);
}
/**
 * Create an in-memory storage adapter for use in tests.
 *
 * No file I/O — the database is discarded when the process exits.
 * Runs migrations so the schema is available immediately.
 */
export async function createInMemoryStorageAdapter() {
    // Passing no arguments (or undefined) to PGlite.create() creates an
    // ephemeral in-memory database. We call the static factory to get the
    // fully-initialized instance rather than `new PGlite()` because the
    // constructor is async-initialized via the static method.
    const db = await PGlite.create();
    await runMigrations(db);
    return new PGLiteStorageAdapter(db);
}
//# sourceMappingURL=adapter.js.map