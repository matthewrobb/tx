// src/adapters/socket/client.ts — SocketTransportAdapter implementing TransportPort.
//
// Why not subclass SockDaemonClient?
//   sock-daemon's SockDaemonClient derives the socket path as
//   resolve('.{serviceName}/daemon/socket') — CWD-relative — and always
//   auto-spawns the daemon script on connect. In v4 the daemon owns a
//   project-ID-keyed socket (see paths.ts) and is managed independently of
//   the CLI. We need explicit path control and no auto-spawn, so we talk to
//   the socket via Node's `net` module directly.
//
// Why no unit tests?
//   This adapter is integration-only: it requires a live daemon process
//   listening on the socket. Mocking a net.Socket at the unit level would test
//   our mock, not the adapter. Integration tests spin up the daemon process,
//   exercise `send()`, and verify the round-trip response shape. See
//   src/adapters/socket/__tests__/ (integration only, skipped in CI without
//   --integration flag) when those tests are written.

import { connect, type Socket } from 'net';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { platform } from 'os';
import type { TransportPort } from '../../ports/transport.js';
import type { DaemonRequest, DaemonResponse } from '../../types/protocol.js';
import { getSocketPath, getProjectId } from './paths.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (response: DaemonResponse) => void;
  // reject is not used: send() never throws — errors become DaemonResponse
  timer: NodeJS.Timeout;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

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
export class SocketTransportAdapter implements TransportPort {
  readonly #socketPath: string;
  readonly #timeoutMs: number;

  #socket: Socket | null = null;
  #connected = false;
  #buffer = '';

  // Pending requests keyed by message id
  #pending = new Map<string, PendingRequest>();

  constructor(options?: {
    /** Override the socket path (default: derived from cwd). */
    socketPath?: string;
    /** Override the project cwd for path derivation. */
    cwd?: string;
    /** Per-request timeout in ms (default: 30000). */
    timeoutMs?: number;
  }) {
    const projectId = getProjectId(options?.cwd);
    this.#socketPath = options?.socketPath ?? getSocketPath(projectId);
    this.#timeoutMs = options?.timeoutMs ?? 30_000;
  }

  get connected(): boolean {
    return this.#connected;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Send a request to the daemon. Connects lazily if not already connected.
   * Always resolves — never rejects. Errors are returned as DaemonResponse.
   */
  async send(request: DaemonRequest): Promise<DaemonResponse> {
    try {
      await this.#ensureConnected();
    } catch (err) {
      return {
        status: 'error',
        message: `Daemon not reachable at ${this.#socketPath}: ${String(err)}`,
        code: 'ECONNREFUSED',
      };
    }

    return new Promise<DaemonResponse>((resolve) => {
      const id = generateId();

      const timer = setTimeout(() => {
        this.#pending.delete(id);
        resolve({
          status: 'error',
          message: `Daemon request timed out after ${this.#timeoutMs}ms (id=${id})`,
          code: 'ETIMEDOUT',
        });
      }, this.#timeoutMs);

      this.#pending.set(id, { resolve, timer });

      // Envelope: { id, ...request }
      const envelope = JSON.stringify({ id, ...request });
      this.#socket!.write(envelope + '\n');
    });
  }

  /**
   * Close the underlying socket and release all resources.
   * In-flight requests are cancelled with an error response.
   */
  async close(): Promise<void> {
    this.#drainPending({
      status: 'error',
      message: 'Transport closed before response received',
      code: 'ECONNRESET',
    });

    return new Promise((resolve) => {
      if (!this.#socket) {
        resolve();
        return;
      }

      const sock = this.#socket;
      this.#socket = null;
      this.#connected = false;
      sock.destroy();
      resolve();
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Connect (or reconnect) to the daemon socket.
   * Throws on failure so `send()` can return a structured error.
   */
  async #ensureConnected(): Promise<void> {
    if (this.#connected && this.#socket && !this.#socket.destroyed) return;

    // Ensure the socket directory exists on Unix (no-op on Windows named pipes)
    if (platform() !== 'win32') {
      await mkdir(dirname(this.#socketPath), { recursive: true }).catch(() => undefined);
    }

    await new Promise<void>((resolve, reject) => {
      const sock = connect(this.#socketPath);

      sock.setEncoding('utf8');

      sock.once('connect', () => {
        this.#socket = sock;
        this.#connected = true;
        this.#buffer = '';
        this.#attachListeners(sock);
        resolve();
      });

      sock.once('error', (err) => {
        reject(err);
      });
    });
  }

  /** Attach data/close/error listeners to an active socket. */
  #attachListeners(sock: Socket): void {
    sock.on('data', (chunk: string) => {
      this.#buffer += chunk;
      this.#flushBuffer();
    });

    const onClose = (): void => {
      this.#connected = false;
      this.#socket = null;
      // Drain any requests that were waiting — the connection dropped
      this.#drainPending({
        status: 'error',
        message: 'Daemon connection closed unexpectedly',
        code: 'ECONNRESET',
      });
    };

    sock.once('close', onClose);
    sock.once('error', onClose);
  }

  /**
   * Parse newline-delimited JSON messages from the read buffer and dispatch
   * each completed message to its waiting promise.
   *
   * The daemon sends one JSON object per line. Partial lines stay in the
   * buffer until the newline arrives.
   */
  #flushBuffer(): void {
    let newline: number;
    while ((newline = this.#buffer.indexOf('\n')) !== -1) {
      const raw = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);

      if (!raw) continue;

      let envelope: { id?: string } & DaemonResponse;
      try {
        // `unknown` narrowed immediately — we inspect `id` before trusting the rest
        envelope = JSON.parse(raw) as { id?: string } & DaemonResponse;
      } catch {
        // Malformed frame — skip; the pending request will eventually time out
        continue;
      }

      const id = envelope.id;
      if (typeof id !== 'string') continue;

      const pending = this.#pending.get(id);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.#pending.delete(id);

      // Strip the transport `id` field before handing the response to the caller
      const { id: _id, ...response } = envelope;
      pending.resolve(response as DaemonResponse);
    }
  }

  /** Cancel all pending requests with a terminal error response. */
  #drainPending(errorResponse: DaemonResponse): void {
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer);
      this.#pending.delete(id);
      pending.resolve(errorResponse);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
