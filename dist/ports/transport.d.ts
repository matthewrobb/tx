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
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';
export interface TransportPort {
    /** Send a request to the daemon and wait for the response. */
    send(request: DaemonRequest): Promise<DaemonResponse>;
    /** Close the transport connection and release resources. */
    close(): Promise<void>;
    /** Whether the transport is currently connected to the daemon. */
    readonly connected: boolean;
}
//# sourceMappingURL=transport.d.ts.map