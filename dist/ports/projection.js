/**
 * ProjectionPort — one-way rendering from DB state to filesystem.
 *
 * The engine calls projection methods after every state change to keep
 * `.twisted/` in sync with the database. This is strictly one-way: the DB
 * is the source of truth (Guiding Principle #4: "DB is truth"), and the
 * filesystem is a read-only projection for human consumption and git commits.
 *
 * Methods take slugs/IDs rather than domain objects. The adapter queries the
 * DB itself to build the rendered output. This keeps the port interface clean
 * and decoupled from domain type evolution — adding a field to Issue doesn't
 * require changing this interface.
 */
export {};
//# sourceMappingURL=projection.js.map