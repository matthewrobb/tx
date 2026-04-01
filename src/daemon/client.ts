/**
 * Daemon client — connects to the daemon, spawning it if not already running.
 *
 * Connect-or-spawn pattern:
 * 1. Check server.json to see if daemon is alive.
 * 2. If not alive, spawn the daemon process detached in the background.
 * 3. Wait briefly for the socket to appear.
 * 4. Send request and return response.
 */

import { SockDaemonClient } from "sock-daemon";
import type { MessageBase } from "sock-daemon";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isDaemonAlive, cleanupStale, readServerJson } from "./lifecycle.js";
import { daemonSocketPath } from "./server.js";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DAEMON_ENTRY = join(__dirname, "daemon-entry.js");

/**
 * Twisted-workflow daemon client.
 */
class TxDaemonClient extends SockDaemonClient<DaemonRequest, DaemonResponse> {
  static override get serviceName(): string {
    return "twisted-workflow";
  }

  static override get daemonScript(): string {
    return DAEMON_ENTRY;
  }
}

/**
 * Ensure the daemon is running, spawning it if necessary.
 */
async function ensureDaemon(twistedRoot: string): Promise<void> {
  cleanupStale(twistedRoot);

  if (isDaemonAlive(twistedRoot)) return;

  if (existsSync(DAEMON_ENTRY)) {
    const child = spawn(process.execPath, [DAEMON_ENTRY, twistedRoot], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }

  // Wait up to 2s for the socket to appear
  const socketPath = daemonSocketPath(twistedRoot);
  for (let i = 0; i < 20; i++) {
    if (existsSync(socketPath)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Send a command to the daemon (connect-or-spawn).
 * Falls back to null if the daemon cannot be reached.
 */
export async function sendToDaemon(
  twistedRoot: string,
  request: Omit<DaemonRequest, "id">,
): Promise<DaemonResponse | null> {
  try {
    await ensureDaemon(twistedRoot);

    const info = readServerJson(twistedRoot);
    if (!info) return null;

    const client = new TxDaemonClient({});
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return await client.request({ id, ...request });
  } catch {
    return null;
  }
}
