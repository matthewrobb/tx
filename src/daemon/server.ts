// src/daemon/server.ts — TwistedDaemon: the single path for all operations.
//
// The daemon owns a PGLite instance (via StoragePort) and a projection adapter
// (via ProjectionPort). All CLI commands flow through the daemon as DaemonRequests
// over a Unix domain socket (or Windows named pipe). The daemon processes one
// request at a time — PGLite's internal mutex serializes concurrent queries, so
// explicit request queuing here is redundant. The net.Server accepts connections
// concurrently, but each handler awaits the full response before replying, which
// means PGLite's mutex naturally serializes overlapping requests.
//
// Socket protocol: newline-delimited JSON.
//   - Each request is one JSON line.
//   - Each response is one JSON line.
//   - One request/response per connection (CLI opens, sends, reads response, closes).
//
// E2E tests for the full daemon (socket + PGLite) are covered by S-027.
// Unit testing the daemon in isolation is impractical because it requires both
// a real socket and PGLite — mocking both erases the behavior we need to verify.

import * as net from 'node:net';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { StoragePort } from '../ports/storage.js';
import type { ProjectionPort } from '../ports/projection.js';
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';

import { createStorageAdapter } from '../adapters/pglite/index.js';
import { MarkdownProjectionAdapter } from '../adapters/markdown/adapter.js';
import { getSocketPath, getProjectId } from '../adapters/socket/paths.js';
import { ProjectionFlusher } from './flush.js';
import {
  handleNext,
  handleStatus,
  handleOpen,
  handleClose,
  handleWrite,
  handleRead,
  handleNote,
  handlePickup,
  handleHandoff,
  handleCheckpoint,
} from './handlers.js';

// ── Request dispatch ──────────────────────────────────────────────────────

/**
 * Route a parsed DaemonRequest to the appropriate handler.
 *
 * Returns a DaemonResponse that the caller serializes and sends back over the
 * socket. After a successful write operation, the caller marks the relevant
 * issue slug as dirty for batched projection.
 */
async function dispatch(
  db: StoragePort,
  projection: ProjectionPort,
  req: DaemonRequest,
): Promise<{ response: DaemonResponse; dirtySlug?: string }> {
  switch (req.command) {
    case 'next': {
      const response = await handleNext(db, projection, req);
      return { response, dirtySlug: req.issue_slug };
    }
    case 'status': {
      const response = await handleStatus(db, req);
      return { response };
    }
    case 'open': {
      const response = await handleOpen(db, projection, req);
      return { response, dirtySlug: req.slug };
    }
    case 'close': {
      const response = await handleClose(db, projection, req);
      return { response, dirtySlug: req.issue_slug };
    }
    case 'write': {
      const response = await handleWrite(db, req);
      return { response, dirtySlug: req.issue_slug };
    }
    case 'read': {
      const response = await handleRead(db, req);
      return { response };
    }
    case 'note': {
      const response = await handleNote(db, req);
      return { response, dirtySlug: req.issue_slug };
    }
    case 'pickup': {
      const response = await handlePickup(db, req);
      return { response };
    }
    case 'handoff': {
      const response = await handleHandoff(db, req);
      return { response };
    }
    case 'checkpoint': {
      const response = await handleCheckpoint(db, req);
      return { response };
    }
    // Cycle commands — handlers are implemented in S-021 (cycle engine).
    // Stubs here keep the dispatch exhaustiveness guard satisfied at compile time.
    case 'cycle_start':
    case 'cycle_pull':
    case 'cycle_close': {
      return {
        response: {
          status: 'error',
          message: `Cycle command '${req.command}' not yet implemented (S-021).`,
        },
      };
    }
    default: {
      // Exhaustiveness guard: if a new command is added to DaemonRequest but not
      // handled here, TypeScript will flag `_never` as an error.
      const _never: never = req;
      return { response: { status: 'error', message: `Unknown command: ${(_never as DaemonRequest).command}` } };
    }
  }
}

// ── TwistedDaemon ─────────────────────────────────────────────────────────

export interface DaemonConfig {
  /** Directory for PGLite data files (e.g., .twisted/data). */
  dataDir: string;
  /** Base path for markdown projections (e.g., .twisted/). */
  basePath: string;
  /** Socket path for IPC. */
  socketPath: string;
}

export class TwistedDaemon {
  private db: StoragePort | null = null;
  private projection: ProjectionPort | null = null;
  private flusher: ProjectionFlusher | null = null;
  private server: net.Server | null = null;

  constructor(private readonly config: DaemonConfig) {}

  /**
   * Start the daemon: create PGLite adapter, bind socket, start listening.
   *
   * Ensures the data directory exists, initializes the storage adapter (which
   * runs migrations), creates the projection adapter and flusher, then binds
   * the net.Server to the configured socket path.
   */
  async start(): Promise<void> {
    // Ensure data directory exists.
    await mkdir(this.config.dataDir, { recursive: true });

    // Initialize storage (PGLite with migrations).
    this.db = await createStorageAdapter(this.config.dataDir);

    // Initialize projection (markdown files under basePath).
    this.projection = new MarkdownProjectionAdapter(this.db, this.config.basePath);

    // Initialize dirty-tracking flusher.
    this.flusher = new ProjectionFlusher(this.projection);
    this.flusher.start();

    // Bind net.Server to the socket path.
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    // On Windows, named pipes don't need directory creation.
    // On Unix, ensure the socket's parent directory exists.
    if (!this.config.socketPath.startsWith('\\\\.\\pipe\\')) {
      await mkdir(dirname(this.config.socketPath), { recursive: true });
    }

    await new Promise<void>((resolve, reject) => {
      const srv = this.server!;
      srv.once('error', reject);
      srv.listen(this.config.socketPath, () => {
        srv.removeListener('error', reject);
        resolve();
      });
    });
  }

  /**
   * Stop the daemon: close socket, flush dirty projections, close DB.
   *
   * Order matters: stop accepting new connections first, flush pending
   * projections, then release the database.
   */
  async stop(): Promise<void> {
    // 1. Stop accepting new connections.
    if (this.server !== null) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // 2. Flush any remaining dirty projections.
    if (this.flusher !== null) {
      await this.flusher.stop();
      this.flusher = null;
    }

    // 3. Release DB resources.
    // StoragePort does not define a close() method — PGLite cleans up on
    // process exit. If the adapter gains a close() in the future, call it here.
    this.db = null;
    this.projection = null;
  }

  /**
   * Handle a single socket connection.
   *
   * Accumulates incoming data until a newline is found, parses the JSON
   * request, dispatches to the appropriate handler, and writes the JSON
   * response back. The connection is closed after the response.
   */
  private handleConnection(socket: net.Socket): void {
    let buf = '';

    socket.on('data', (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        void this.processRequest(socket, line);
      }
    });

    socket.on('error', () => {
      // Client disconnected or pipe broke — nothing to do. The request
      // (if in progress) will complete but the response write will fail
      // silently, which is fine.
    });
  }

  /**
   * Parse a request line, dispatch, write the response, and close.
   */
  private async processRequest(socket: net.Socket, line: string): Promise<void> {
    let response: DaemonResponse;

    try {
      const req = JSON.parse(line) as DaemonRequest;
      const result = await dispatch(this.db!, this.projection!, req);
      response = result.response;

      // Mark dirty for batched projection flush.
      if (result.dirtySlug !== undefined && this.flusher !== null) {
        this.flusher.markDirty(result.dirtySlug);
      }
    } catch (err) {
      response = { status: 'error', message: (err as Error).message };
    }

    const payload = JSON.stringify(response) + '\n';
    socket.end(payload);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────

/**
 * Start a daemon for the current project.
 *
 * Resolves the project ID from `cwd`, derives the socket path and data
 * directory, and starts the TwistedDaemon.
 */
export async function startDaemon(cwd?: string): Promise<TwistedDaemon> {
  const projectId = getProjectId(cwd);
  const socketPath = getSocketPath(projectId);
  const basePath = join(cwd ?? process.cwd(), '.twisted');
  const dataDir = join(basePath, 'data');

  const daemon = new TwistedDaemon({ dataDir, basePath, socketPath });
  await daemon.start();
  return daemon;
}
