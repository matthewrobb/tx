/**
 * Daemon lifecycle — server.json management.
 *
 * server.json is written when the daemon starts and deleted when it stops.
 * Stale detection: if the PID in server.json is no longer running, the daemon is gone.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
/**
 * Path to server.json in the .twisted directory.
 */
export function serverJsonPath(twistedRoot) {
    return join(twistedRoot, ".twisted", "server.json");
}
/**
 * Write server.json when the daemon starts.
 */
export function writeServerJson(twistedRoot, socket) {
    const info = {
        pid: process.pid,
        socket,
        started: new Date().toISOString(),
    };
    writeFileSync(serverJsonPath(twistedRoot), JSON.stringify(info, null, 2), "utf-8");
}
/**
 * Delete server.json when the daemon stops.
 */
export function deleteServerJson(twistedRoot) {
    const path = serverJsonPath(twistedRoot);
    if (existsSync(path))
        unlinkSync(path);
}
/**
 * Read server.json, or return null if it doesn't exist.
 */
export function readServerJson(twistedRoot) {
    const path = serverJsonPath(twistedRoot);
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf-8"));
}
/**
 * Check whether the PID in server.json is still running.
 * Returns false if server.json doesn't exist or the process is gone (stale).
 */
export function isDaemonAlive(twistedRoot) {
    const info = readServerJson(twistedRoot);
    if (!info)
        return false;
    try {
        // Signal 0 checks if the process exists without sending a real signal
        process.kill(info.pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Clean up a stale server.json if the daemon process is gone.
 */
export function cleanupStale(twistedRoot) {
    if (readServerJson(twistedRoot) && !isDaemonAlive(twistedRoot)) {
        deleteServerJson(twistedRoot);
    }
}
//# sourceMappingURL=lifecycle.js.map