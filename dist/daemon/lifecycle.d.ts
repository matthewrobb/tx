/**
 * Daemon lifecycle — server.json management.
 *
 * server.json is written when the daemon starts and deleted when it stops.
 * Stale detection: if the PID in server.json is no longer running, the daemon is gone.
 */
interface ServerInfo {
    pid: number;
    socket: string;
    started: string;
}
/**
 * Path to server.json in the .twisted directory.
 */
export declare function serverJsonPath(twistedRoot: string): string;
/**
 * Write server.json when the daemon starts.
 */
export declare function writeServerJson(twistedRoot: string, socket: string): void;
/**
 * Delete server.json when the daemon stops.
 */
export declare function deleteServerJson(twistedRoot: string): void;
/**
 * Read server.json, or return null if it doesn't exist.
 */
export declare function readServerJson(twistedRoot: string): ServerInfo | null;
/**
 * Check whether the PID in server.json is still running.
 * Returns false if server.json doesn't exist or the process is gone (stale).
 */
export declare function isDaemonAlive(twistedRoot: string): boolean;
/**
 * Clean up a stale server.json if the daemon process is gone.
 */
export declare function cleanupStale(twistedRoot: string): void;
export {};
//# sourceMappingURL=lifecycle.d.ts.map