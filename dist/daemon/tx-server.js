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
import { SockDaemonServer } from 'sock-daemon';
import { createStorageAdapter } from '../adapters/pglite/index.js';
import { MarkdownProjectionAdapter } from '../adapters/markdown/adapter.js';
import { ProjectionFlusher } from './flush.js';
import { handleNext, handleStatus, handleOpen, handleClose, handleWrite, handleRead, handleNote, handlePickup, handleHandoff, handleCheckpoint, handleCycleStart, handleCyclePull, handleCycleClose, } from './handlers.js';
// ── Server ───────────────────────────────────────────────────────────────
export class TxDaemonServer extends SockDaemonServer {
    static get serviceName() { return ''; }
    db = null;
    projection = null;
    flusher = null;
    /** Absolute path to the project's .twisted/ dir (for markdown projections). */
    basePath;
    /** Absolute path to PGLite data directory. */
    dataDir;
    initPromise = null;
    constructor(options) {
        super({ idleTimeout: options.idleTimeout ?? 3_600_000 });
        this.basePath = options.basePath;
        this.dataDir = options.dataDir;
    }
    /**
     * Lazy-initialize PGLite and projection on first request.
     * This avoids blocking sock-daemon's listen() with slow WASM init.
     */
    async ensureInitialized() {
        if (this.db)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            await mkdir(this.dataDir, { recursive: true });
            this.db = await createStorageAdapter(this.dataDir);
            this.projection = new MarkdownProjectionAdapter(this.db, this.basePath);
            this.flusher = new ProjectionFlusher(this.projection);
            this.flusher.start();
        })();
        return this.initPromise;
    }
    async handle(msg) {
        await this.ensureInitialized();
        try {
            const result = await dispatch(this.db, this.projection, msg);
            if (result.dirtySlug !== undefined && this.flusher !== null) {
                this.flusher.markDirty(result.dirtySlug);
            }
            return result.response;
        }
        catch (err) {
            return { status: 'error', message: err.message };
        }
    }
    close() {
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
async function dispatch(db, projection, req) {
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
            const _never = req;
            return { response: { status: 'error', message: `Unknown command: ${_never.command}` } };
        }
    }
}
//# sourceMappingURL=tx-server.js.map