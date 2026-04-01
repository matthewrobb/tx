/**
 * Daemon server — listens on a socket for engine requests.
 *
 * Extends SockDaemonServer with the required static getters.
 * The server dispatches to the engine and returns JSON responses.
 */

import { SockDaemonServer } from "sock-daemon";
import type { MessageBase } from "sock-daemon";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { writeServerJson, deleteServerJson } from "./lifecycle.js";
import { txNext } from "../engine/next.js";
import { resolveConfigV4 } from "../config/resolve.js";
import { readSettings } from "../cli/fs.js";
import type { TwistedSettings } from "../../types/config.js";
import type { EngineResult } from "../../types/engine.js";

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
export function daemonSocketPath(twistedRoot: string): string {
  const hash = createHash("sha1").update(twistedRoot).digest("hex").slice(0, 8);
  return join(tmpdir(), `twisted-${hash}.sock`);
}

/**
 * Twisted-workflow daemon server.
 */
export class TxDaemonServer extends SockDaemonServer<DaemonRequest, DaemonResponse> {
  static override get serviceName(): string {
    return "twisted-workflow";
  }

  #twistedRoot: string;

  constructor(twistedRoot: string) {
    super({});
    this.#twistedRoot = twistedRoot;
  }

  override async handle(req: DaemonRequest): Promise<Omit<DaemonResponse, "id">> {
    try {
      const root = req.root ?? this.#twistedRoot;
      const rawSettings = readSettings(root);
      const config = resolveConfigV4(rawSettings as TwistedSettings);

      if (req.command === "next") {
        if (!req.epic) return { error: "epic required" };
        const result = txNext(root, req.epic, config);
        return { result };
      }

      return { error: `Unknown command: ${req.command}` };
    } catch (err) {
      return { error: String(err) };
    }
  }
}

/**
 * Start the daemon server and write server.json.
 */
export function startServer(twistedRoot: string): void {
  const server = new TxDaemonServer(twistedRoot);

  writeServerJson(twistedRoot, daemonSocketPath(twistedRoot));

  process.on("exit", () => deleteServerJson(twistedRoot));
  process.on("SIGINT", () => { deleteServerJson(twistedRoot); process.exit(0); });
  process.on("SIGTERM", () => { deleteServerJson(twistedRoot); process.exit(0); });

  server.listen();
}
