/**
 * Daemon server — listens on a socket for engine requests.
 *
 * Extends SockDaemonServer with the required static getters.
 * The server dispatches to the engine and returns JSON responses.
 */
import { SockDaemonServer } from "sock-daemon";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { writeServerJson, deleteServerJson } from "./lifecycle.js";
import { txNext } from "../engine/next.js";
import { resolveConfig } from "../config/resolve.js";
import { readSettings } from "../cli/fs.js";
/**
 * Socket path for the daemon.
 *
 * Stored in the OS temp directory, keyed by a hash of the project root.
 * This avoids path-length issues on Windows and keeps sockets out of the repo.
 * Format: {tmpdir}/twisted-{8-char-hash}.sock
 */
export function daemonSocketPath(twistedRoot) {
    const hash = createHash("sha1").update(twistedRoot).digest("hex").slice(0, 8);
    return join(tmpdir(), `twisted-${hash}.sock`);
}
/**
 * Twisted-workflow daemon server.
 */
export class TxDaemonServer extends SockDaemonServer {
    static get serviceName() {
        return "twisted-workflow";
    }
    #twistedRoot;
    constructor(twistedRoot) {
        super({});
        this.#twistedRoot = twistedRoot;
    }
    async handle(req) {
        try {
            const root = req.root ?? this.#twistedRoot;
            const rawSettings = readSettings(root);
            const config = resolveConfig(rawSettings);
            if (req.command === "next") {
                if (!req.epic)
                    return { error: "epic required" };
                const result = txNext(root, req.epic, config);
                return { result };
            }
            return { error: `Unknown command: ${req.command}` };
        }
        catch (err) {
            return { error: String(err) };
        }
    }
}
/**
 * Start the daemon server and write server.json.
 */
export function startServer(twistedRoot) {
    const server = new TxDaemonServer(twistedRoot);
    writeServerJson(twistedRoot, daemonSocketPath(twistedRoot));
    process.on("exit", () => deleteServerJson(twistedRoot));
    process.on("SIGINT", () => { deleteServerJson(twistedRoot); process.exit(0); });
    process.on("SIGTERM", () => { deleteServerJson(twistedRoot); process.exit(0); });
    server.listen();
}
//# sourceMappingURL=server.js.map