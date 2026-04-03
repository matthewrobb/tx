/**
 * TransportPort — IPC socket communication between CLI client and daemon.
 *
 * The daemon is the single path for all operations (Guiding Principle #5).
 * The CLI is a thin socket client that sends requests and receives responses.
 *
 * Platform transport:
 * - Windows: named pipes (\\.\pipe\twisted-{projectId})
 * - Unix: Unix domain sockets (~/.twisted/twisted-{projectId}.sock)
 *
 * The adapter handles platform detection — this port is platform-agnostic.
 */
export {};
//# sourceMappingURL=transport.js.map