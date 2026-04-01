/**
 * Daemon server — listens on a socket for engine requests.
 *
 * Each request is a JSON object with a `command` field.
 * The server dispatches to the engine and returns a JSON response.
 *
 * Uses sock-daemon for cross-platform socket management.
 */

import { SockDaemonServer } from "sock-daemon";
import { join } from "path";
import { writeServerJson, deleteServerJson } from "./lifecycle.js";
import { txNext } from "../engine/next.js";
import { resolveConfigV4 } from "../config/resolve.js";
import { readSettings } from "../cli/fs.js";
import type { TwistedSettings } from "../../types/config.js";
import type { EngineResult } from "../../types/engine.js";

interface DaemonRequest {
  id: string;
  command: "next" | "status";
  epic?: string;
  root?: string;
}

interface DaemonResponse {
  id: string;
  result?: EngineResult;
  error?: string;
}

/**
 * Create and start the daemon server.
 *
 * @param twistedRoot - Absolute path to the project root (parent of .twisted/).
 * @param socketPath - Path for the Unix socket / named pipe.
 */
export function startServer(twistedRoot: string, socketPath: string): void {
  const server = new SockDaemonServer<DaemonRequest, DaemonResponse>({
    path: socketPath,
    handler: async (req): Promise<DaemonResponse> => {
      try {
        const root = req.root ?? twistedRoot;
        const rawSettings = readSettings(root);
        const config = resolveConfigV4(rawSettings as TwistedSettings);

        if (req.command === "next") {
          if (!req.epic) return { id: req.id, error: "epic required" };
          const result = txNext(root, req.epic, config);
          return { id: req.id, result };
        }

        return { id: req.id, error: `Unknown command: ${req.command}` };
      } catch (err) {
        return { id: req.id, error: String(err) };
      }
    },
  });

  writeServerJson(twistedRoot, socketPath);

  process.on("exit", () => deleteServerJson(twistedRoot));
  process.on("SIGINT", () => { deleteServerJson(twistedRoot); process.exit(0); });
  process.on("SIGTERM", () => { deleteServerJson(twistedRoot); process.exit(0); });

  server.listen();
}

/**
 * Socket path for the daemon (stored inside .twisted/).
 */
export function daemonSocketPath(twistedRoot: string): string {
  return join(twistedRoot, ".twisted", "daemon.sock");
}
