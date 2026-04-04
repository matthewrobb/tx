import { SockDaemonServer } from 'sock-daemon';
import type { MessageBase } from 'sock-daemon';
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';
/** DaemonRequest with sock-daemon's required `id` field. */
export type TxRequest = DaemonRequest & MessageBase;
/** DaemonResponse with sock-daemon's required `id` field. */
export type TxResponse = DaemonResponse & MessageBase;
export declare class TxDaemonServer extends SockDaemonServer<TxRequest, TxResponse> {
    static get serviceName(): string;
    private db;
    private projection;
    private flusher;
    /** Absolute path to the project's .twisted/ dir (for markdown projections). */
    private readonly basePath;
    /** Absolute path to PGLite data directory. */
    private readonly dataDir;
    private initPromise;
    constructor(options: {
        basePath: string;
        dataDir: string;
        idleTimeout?: number;
    });
    /**
     * Lazy-initialize PGLite and projection on first request.
     * This avoids blocking sock-daemon's listen() with slow WASM init.
     */
    private ensureInitialized;
    handle(msg: TxRequest): Promise<Omit<TxResponse, 'id'>>;
    close(): void;
}
//# sourceMappingURL=tx-server.d.ts.map