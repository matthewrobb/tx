// src/daemon/tx-client.ts — SockDaemonClient subclass for tx.
//
// The client must be constructed after:
//   1. process.chdir(projectDir) — so sock-daemon resolves socket paths correctly
//   2. process.env.TX_PROJECT_DIR = projectDir — passed to spawned daemon
//   3. process.env.TX_BASE_PATH = basePath — passed to spawned daemon
//
// Use createTxClient() to handle this setup. It returns a TransportPort-compatible
// adapter so existing CLI commands work without changes.
import { SockDaemonClient } from 'sock-daemon';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveProjectDir } from '../config/project-name.js';
class TxDaemonClient extends SockDaemonClient {
    static get serviceName() { return 'tx'; }
    static get daemonScript() {
        return new URL('./daemon-entry.js', import.meta.url);
    }
}
// ── TransportPort adapter ────────────────────────────────────────────────
/**
 * Wraps TxDaemonClient to present the TransportPort interface that CLI
 * commands expect (send/close/connected).
 */
class TxTransportAdapter {
    #client;
    constructor(client) {
        this.#client = client;
    }
    get connected() {
        return this.#client.connected;
    }
    async send(request) {
        try {
            const response = await this.#client.request(request);
            // Strip sock-daemon's `id` field before returning.
            const { id: _id, ...rest } = response;
            return rest;
        }
        catch (err) {
            return {
                status: 'error',
                message: `Daemon request failed: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    async close() {
        this.#client.disconnect();
    }
}
// ── Factory ──────────────────────────────────────────────────────────────
/**
 * Create a TransportPort backed by sock-daemon.
 *
 * Sets up the CWD and env vars needed for sock-daemon's path resolution
 * and daemon spawning, then returns an adapter compatible with existing
 * CLI command code.
 *
 * @param cwd - The project's working directory (where .twisted/ lives)
 */
export async function createTxClient(cwd) {
    const projectCwd = cwd ?? process.cwd();
    const projectDir = resolveProjectDir(projectCwd);
    const basePath = join(projectCwd, '.twisted');
    // Ensure the project user-dir exists before sock-daemon tries to create
    // its .tx/daemon/ subdirectory inside it.
    await mkdir(projectDir, { recursive: true });
    // Set env vars that daemon-entry.ts reads on spawn.
    process.env.TX_PROJECT_DIR = projectDir;
    process.env.TX_BASE_PATH = basePath;
    // sock-daemon resolves socket path from CWD.
    const originalCwd = process.cwd();
    process.chdir(projectDir);
    const client = new TxDaemonClient();
    // Restore CWD so the rest of the CLI operates in the project directory.
    process.chdir(originalCwd);
    return new TxTransportAdapter(client);
}
//# sourceMappingURL=tx-client.js.map