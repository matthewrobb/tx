/**
 * Daemon client — connects to the daemon, spawning it if not already running.
 *
 * Connect-or-spawn pattern:
 * 1. Check server.json to see if daemon is alive.
 * 2. If not alive, spawn the daemon process detached in the background.
 * 3. Wait briefly for the socket to appear.
 * 4. Send request and return response.
 */
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
 * Send a command to the daemon (connect-or-spawn).
 * Falls back to null if the daemon cannot be reached.
 */
export declare function sendToDaemon(twistedRoot: string, request: Omit<DaemonRequest, "id">): Promise<DaemonResponse | null>;
export {};
//# sourceMappingURL=client.d.ts.map