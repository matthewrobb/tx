import type { TransportPort } from '../ports/transport.js';
/**
 * Create a TransportPort backed by sock-daemon.
 *
 * Sets up the CWD and env vars needed for sock-daemon's path resolution
 * and daemon spawning, then returns an adapter compatible with existing
 * CLI command code.
 *
 * @param cwd - The project's working directory (where .twisted/ lives)
 */
export declare function createTxClient(cwd?: string): Promise<TransportPort>;
//# sourceMappingURL=tx-client.d.ts.map