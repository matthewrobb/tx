/**
 * StoragePort — wraps PGLite's query/transaction API.
 *
 * Shaped by PGLite's actual TypeScript interface (Postgres 17 compiled to WASM).
 * PGLite uses a single connection with internal mutex serialization — concurrent
 * queries queue behind the mutex, they don't error. There is no connection pool,
 * no acquire/release lifecycle.
 *
 * Key design decision: `query()` and `exec()` accept an optional `tx` parameter
 * so callers can compose transactions by passing the transaction handle down the
 * call chain. The adapter uses `tx ?? db` internally — if no transaction is
 * provided, the operation runs against the root connection. This is PGLite's
 * standard pattern for composable transactions and avoids needing a separate
 * "transactional" wrapper type.
 */
/** Mirrors @electric-sql/pglite Results<T>. */
export interface QueryResults<T> {
    readonly rows: T[];
    readonly affectedRows?: number;
    /** Field metadata from Postgres. ReadonlyArray because callers should never mutate this. */
    readonly fields: ReadonlyArray<{
        name: string;
        dataTypeID: number;
    }>;
}
/**
 * A transaction handle with the same query methods as StoragePort itself.
 * Obtained via `StoragePort.transaction()` callback — auto-commits on resolve,
 * auto-rollbacks on reject. Mirrors PGLite's Transaction interface.
 */
export interface StorageTx {
    /** Execute a parameterized query within this transaction. */
    query<T>(sql: string, params?: unknown[]): Promise<QueryResults<T>>;
    /** Execute raw SQL statements (DDL, multi-statement) within this transaction. */
    exec(sql: string): Promise<Array<QueryResults<unknown>>>;
    /** Explicitly rollback the transaction. Normally unnecessary — rejecting the callback auto-rollbacks. */
    rollback(): Promise<void>;
    /** True after commit or rollback. Queries on a closed transaction should throw. */
    readonly closed: boolean;
}
export interface StoragePort {
    /**
     * Execute a parameterized query.
     *
     * @param sql - SQL string with $1, $2, ... placeholders
     * @param params - Parameter values (Postgres handles escaping)
     * @param tx - Optional transaction handle for composable transactions.
     *             When provided, the query runs within that transaction.
     *             When omitted, runs against the root connection.
     */
    query<T>(sql: string, params?: unknown[], tx?: StorageTx): Promise<QueryResults<T>>;
    /**
     * Execute raw SQL statements (DDL, migrations, multi-statement strings).
     *
     * @param sql - One or more SQL statements separated by semicolons
     * @param tx - Optional transaction handle (same composability as query)
     */
    exec(sql: string, tx?: StorageTx): Promise<Array<QueryResults<unknown>>>;
    /**
     * Run a callback inside a transaction.
     *
     * Auto-commits when the callback's promise resolves.
     * Auto-rollbacks when the callback's promise rejects.
     * The `tx` handle passed to the callback should be threaded down to any
     * `query()` or `exec()` calls that need to participate in the transaction.
     */
    transaction<T>(callback: (tx: StorageTx) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=storage.d.ts.map