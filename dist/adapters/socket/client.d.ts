import type { TransportPort } from '../../ports/transport.js';
import type { DaemonRequest, DaemonResponse } from '../../types/protocol.js';
/**
 * SocketTransportAdapter — sends DaemonRequests over a Unix socket or Windows
 * named pipe and returns DaemonResponses.
 *
 * Connection lifecycle:
 *   - Connects lazily on the first `send()` call.
 *   - Reconnects automatically if the socket closes between calls.
 *   - Each request is assigned a unique `id`; responses are matched by id so
 *     concurrent in-flight requests are safe (though today the daemon processes
 *     them serially — the matching overhead is negligible and keeps this robust
 *     for future daemon concurrency).
 *
 * Error handling:
 *   - If the daemon is not running, `send()` resolves with
 *     `{ status: 'error', message: '...' }`. It never throws.
 *   - A per-request timeout (default 30 s) guards against a hung daemon.
 */
export declare class SocketTransportAdapter implements TransportPort {
    #private;
    constructor(options?: {
        /** Override the socket path (default: derived from cwd). */
        socketPath?: string;
        /** Override the project cwd for path derivation. */
        cwd?: string;
        /** Per-request timeout in ms (default: 30000). */
        timeoutMs?: number;
    });
    get connected(): boolean;
    /**
     * Send a request to the daemon. Connects lazily if not already connected.
     * Always resolves — never rejects. Errors are returned as DaemonResponse.
     */
    send(request: DaemonRequest): Promise<DaemonResponse>;
    /**
     * Close the underlying socket and release all resources.
     * In-flight requests are cancelled with an error response.
     */
    close(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map