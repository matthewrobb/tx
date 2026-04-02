/**
 * Daemon server — listens on a socket for engine requests.
 *
 * Extends SockDaemonServer with the required static getters.
 * The server dispatches to the engine and returns JSON responses.
 */
import { SockDaemonServer } from "sock-daemon";
import type { MessageBase } from "sock-daemon";
import type { EngineResult } from "../types/engine.js";
interface DaemonRequest extends MessageBase {
    command: "next" | "status";
    epic?: string;
    root?: string;
}
interface DaemonResponse extends MessageBase {
    result?: EngineResult;
    error?: string;
}
/**
 * Socket path for the daemon.
 *
 * Stored in the OS temp directory, keyed by a hash of the project root.
 * This avoids path-length issues on Windows and keeps sockets out of the repo.
 * Format: {tmpdir}/twisted-{8-char-hash}.sock
 */
export declare function daemonSocketPath(twistedRoot: string): string;
/**
 * Twisted-workflow daemon server.
 */
export declare class TxDaemonServer extends SockDaemonServer<DaemonRequest, DaemonResponse> {
    #private;
    static get serviceName(): string;
    constructor(twistedRoot: string);
    handle(req: DaemonRequest): Promise<Omit<DaemonResponse, "id">>;
}
/**
 * Start the daemon server and write server.json.
 */
export declare function startServer(twistedRoot: string): void;
export {};
//# sourceMappingURL=server.d.ts.map