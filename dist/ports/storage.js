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
export {};
//# sourceMappingURL=storage.js.map