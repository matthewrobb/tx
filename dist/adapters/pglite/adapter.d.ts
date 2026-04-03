import { PGlite } from '@electric-sql/pglite';
import type { StoragePort, StorageTx, QueryResults } from '../../ports/storage.js';
export declare class PGLiteStorageAdapter implements StoragePort {
    private readonly db;
    constructor(db: PGlite);
    /**
     * Execute a parameterized query.
     *
     * When `tx` is provided, the query runs inside that transaction.
     * When omitted, it runs against the root connection (auto-committed).
     */
    query<T>(sql: string, params?: unknown[], tx?: StorageTx): Promise<QueryResults<T>>;
    /**
     * Execute raw SQL (DDL, multi-statement, migrations).
     *
     * When `tx` is provided, the statements run inside that transaction.
     */
    exec(sql: string, tx?: StorageTx): Promise<Array<QueryResults<unknown>>>;
    /**
     * Run a callback inside a transaction.
     *
     * PGLite handles auto-commit on resolve and auto-rollback on reject.
     * We wrap the native PGLite Transaction in PGLiteStorageTx so callers
     * can thread it through nested `query()`/`exec()` calls.
     */
    transaction<T>(callback: (tx: StorageTx) => Promise<T>): Promise<T>;
}
/**
 * Create a persistent storage adapter backed by a directory on disk.
 *
 * Runs migrations before returning so the schema is always up to date.
 */
export declare function createStorageAdapter(dataDir: string): Promise<PGLiteStorageAdapter>;
/**
 * Create an in-memory storage adapter for use in tests.
 *
 * No file I/O — the database is discarded when the process exits.
 * Runs migrations so the schema is available immediately.
 */
export declare function createInMemoryStorageAdapter(): Promise<PGLiteStorageAdapter>;
//# sourceMappingURL=adapter.d.ts.map