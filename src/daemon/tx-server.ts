// src/daemon/tx-server.ts — SockDaemonServer subclass for tx.
//
// Wraps the existing dispatch/handler logic in sock-daemon's server lifecycle.
// sock-daemon handles: PID tracking, starting lock, stale detection, usurp,
// idle timeout, signal-exit cleanup, and EADDRINUSE recovery.
//
// The daemon process CWD must be set to the project's user-dir
// (~/.twisted/projects/{name}/) before constructing this server, so that
// sock-daemon's socket path resolves to .tx/daemon/socket inside that dir.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SockDaemonServer } from 'sock-daemon';
import type { MessageBase } from 'sock-daemon';

import type { StoragePort } from '../ports/storage.js';
import type { ProjectionPort } from '../ports/projection.js';
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';

import { createStorageAdapter } from '../adapters/pglite/index.js';
import { MarkdownProjectionAdapter } from '../adapters/markdown/adapter.js';
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
  handleCycleStart,
  handleCyclePull,
  handleCycleClose,
} from './handlers.js';

// ── sock-daemon message types ────────────────────────────────────────────

/** DaemonRequest with sock-daemon's required `id` field. */
export type TxRequest = DaemonRequest & MessageBase;

/** DaemonResponse with sock-daemon's required `id` field. */
export type TxResponse = DaemonResponse & MessageBase;

// ── Server ───────────────────────────────────────────────────────────────

export class TxDaemonServer extends SockDaemonServer<TxRequest, TxResponse> {
  static override get serviceName(): string { return ''; }

  private db: StoragePort | null = null;
  private projection: ProjectionPort | null = null;
  private flusher: ProjectionFlusher | null = null;

  /** Absolute path to the project's .twisted/ dir (for markdown projections). */
  private readonly basePath: string;

  /** Absolute path to PGLite data directory. */
  private readonly dataDir: string;

  private initPromise: Promise<void> | null = null;

  constructor(options: { basePath: string; dataDir: string; idleTimeout?: number }) {
    super({ idleTimeout: options.idleTimeout ?? 5 * 60_000 });
    this.basePath = options.basePath;
    this.dataDir = options.dataDir;
  }

  /**
   * Lazy-initialize PGLite and projection on first request.
   * This avoids blocking sock-daemon's listen() with slow WASM init.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await mkdir(this.dataDir, { recursive: true });
      this.db = await createStorageAdapter(this.dataDir);
      this.projection = new MarkdownProjectionAdapter(this.db, this.basePath);
      this.flusher = new ProjectionFlusher(this.projection);
      this.flusher.start();
    })();

    return this.initPromise;
  }

  override async handle(msg: TxRequest): Promise<Omit<TxResponse, 'id'>> {
    await this.ensureInitialized();

    try {
      const result = await dispatch(this.db!, this.projection!, msg);

      if (result.dirtySlug !== undefined && this.flusher !== null) {
        this.flusher.markDirty(result.dirtySlug);
      }

      return result.response as Omit<TxResponse, 'id'>;
    } catch (err) {
      return { status: 'error', message: (err as Error).message } as Omit<TxResponse, 'id'>;
    }
  }

  override close(): void {
    if (this.flusher) {
      // Fire-and-forget final flush — sock-daemon close is synchronous.
      void this.flusher.stop();
      this.flusher = null;
    }
    this.db = null;
    this.projection = null;
    super.close();
  }
}

// ── Dispatch (extracted from server.ts) ──────────────────────────────────

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
    case 'cycle_start': {
      const response = await handleCycleStart(db, req);
      return { response };
    }
    case 'cycle_pull': {
      const response = await handleCyclePull(db, req);
      return { response };
    }
    case 'cycle_close': {
      const response = await handleCycleClose(db, req);
      return { response };
    }
    default: {
      const _never: never = req;
      return { response: { status: 'error', message: `Unknown command: ${(_never as DaemonRequest).command}` } };
    }
  }
}
