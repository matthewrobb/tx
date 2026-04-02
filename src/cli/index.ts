#!/usr/bin/env node
// src/cli/index.ts
import { Command } from "commander";
import { output } from "./output.js";
import { resolveConfig } from "../config/resolve.js";
import {
  findRoot, twistedDir, findEpics, locateEpic, readCoreState,
  readActiveSession, writeActiveSession, listSessions,
} from "./fs.js";
import type { AgentResponse, TwistedConfig, SessionAction, ActiveSession } from "../types/index.js";
import type { CliContext } from "./context.js";
import { registerLifecycleCommands } from "./commands/lifecycle.js";
import { registerStepsCommands } from "./commands/steps.js";
import { registerTasksCommands } from "./commands/tasks.js";
import { registerNotesCommands } from "./commands/notes.js";
import { registerSessionCommands } from "./commands/session.js";
import { registerArtifactsCommands } from "./commands/artifacts.js";
import { registerEpicCommands } from "./commands/epic.js";
import { registerConfigCommands } from "./commands/config.js";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const root = findRoot(process.cwd());

function loadSettings(): Record<string, unknown> {
  const path = join(twistedDir(root), "settings.json");
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return {}; }
}

const settings = loadSettings();
const config: TwistedConfig = resolveConfig(settings);

const program = new Command();

program
  .name("tx")
  .description("twisted-workflow CLI")
  .version(`twisted-workflow v${config.version}`, "-v, --version")
  .option("-a, --agent", "JSON output", false)
  .option("-y, --yolo", "skip confirmations", false)
  .option("-e, --epic <epic>", "target a specific epic");

function respond(response: AgentResponse): void {
  const opts = program.opts();
  output(response, opts.agent as boolean);
}

/**
 * Find the active epic, respecting -e/--epic global flag.
 * Returns { dir, state } or null.
 */
function findActiveEpic(): { dir: string; epicName: string; state: ReturnType<typeof readCoreState> } | null {
  const epicFlag = program.opts().epic as string | undefined;
  if (epicFlag) {
    const location = locateEpic(root, epicFlag);
    if (!location) return null;
    const state = readCoreState(location.dir);
    return { dir: location.dir, epicName: epicFlag, state };
  }
  const epics = findEpics(root);
  const active = epics
    .map((e) => {
      try {
        const state = readCoreState(e.dir);
        return { dir: e.dir, epicName: e.epic, state };
      } catch {
        return null;
      }
    })
    .filter((e): e is { dir: string; epicName: string; state: ReturnType<typeof readCoreState> } =>
      e !== null && e.state.status === "active"
    )
    .sort((a, b) => b.state.updated.localeCompare(a.state.updated));
  if (active.length === 0) return null;
  return active[0]!;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function ensureSession(epicDir: string, step: string): void {
  const existing = readActiveSession(epicDir);
  if (existing) return;
  const sessions = listSessions(epicDir);
  const nextNumber = sessions.length > 0
    ? Math.max(...sessions.map((s) => s.number)) + 1
    : 1;
  const sess: ActiveSession = {
    number: nextNumber,
    name: null,
    step_started: step,
    started: new Date().toISOString(),
    actions: [],
  };
  writeActiveSession(epicDir, sess);
}

function logAction(epicDir: string, action: SessionAction): void {
  const sess = readActiveSession(epicDir);
  if (!sess) return;
  sess.actions.push(action);
  writeActiveSession(epicDir, sess);
}

const ctx: CliContext = {
  root,
  config,
  respond,
  findActiveEpic,
  readStdin,
  ensureSession,
  logAction,
};

registerLifecycleCommands(program, ctx);
registerStepsCommands(program, ctx);
registerTasksCommands(program, ctx);
registerNotesCommands(program, ctx);
registerSessionCommands(program, ctx);
registerArtifactsCommands(program, ctx);
registerEpicCommands(program, ctx);
registerConfigCommands(program, ctx);

// ─── Default action (no subcommand) ──────────────────────────────────────────

program.action(() => {
  const epics = findEpics(root);
  if (epics.length === 0) {
    respond({ status: "ok", command: "interactive", display: "No epics. Run: tx open <name>" });
  } else {
    const lines = epics.map((e) => {
      try {
        const s = readCoreState(e.dir);
        return `${s.epic}  ${s.lane}  ${s.step}  ${s.status}`;
      } catch {
        return `${e.epic}  (unreadable state)`;
      }
    });
    respond({ status: "ok", command: "interactive", display: lines.join("\n") });
  }
});

program.parseAsync(process.argv).catch((err: Error) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
