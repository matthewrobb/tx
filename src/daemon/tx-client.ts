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
import type { TxRequest, TxResponse } from './tx-server.js';
import type { TransportPort } from '../ports/transport.js';
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';
import { resolveProjectDir } from '../config/project-name.js';

class TxDaemonClient extends SockDaemonClient<TxRequest, TxResponse> {
  static override get serviceName(): string { return 'tx'; }

  static override get daemonScript(): string | URL {
    return new URL('./daemon-entry.js', import.meta.url);
  }
}

// ── TransportPort adapter ────────────────────────────────────────────────

/**
 * Wraps TxDaemonClient to present the TransportPort interface that CLI
 * commands expect (send/close/connected).
 */
class TxTransportAdapter implements TransportPort {
  readonly #client: TxDaemonClient;

  constructor(client: TxDaemonClient) {
    this.#client = client;
  }

  get connected(): boolean {
    return this.#client.connected;
  }

  async send(request: DaemonRequest): Promise<DaemonResponse> {
    try {
      const response = await this.#client.request(request as TxRequest);
      // Strip sock-daemon's `id` field before returning.
      const { id: _id, ...rest } = response;
      return rest as DaemonResponse;
    } catch (err) {
      return {
        status: 'error',
        message: `Daemon request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async close(): Promise<void> {
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
export async function createTxClient(cwd?: string): Promise<TransportPort> {
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
