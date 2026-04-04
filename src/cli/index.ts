#!/usr/bin/env node
// src/cli/index.ts — v4 entry point: thin socket client.
//
// Every command (except `tx init`) sends a DaemonRequest via sock-daemon
// and prints the DaemonResponse. No business logic lives here. The daemon owns
// all state, config resolution, and workflow execution.
//
// Auto-start:
//   sock-daemon handles daemon lifecycle automatically. On the first request,
//   if no daemon is running, the client spawns one via daemon-entry.ts. Stale
//   process detection, PID tracking, and idle timeout are all built-in.

import { Command } from 'commander';
import { createRequire } from 'node:module';

import { createTxClient } from '../daemon/tx-client.js';
import { printError, printResponse, setCurrentCommand } from './output.js';
import type { TransportPort } from '../ports/transport.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

import { registerIssueCommands } from './commands/issue.js';
import { registerCycleCommands } from './commands/cycle.js';
import { registerNoteCommand } from './commands/note.js';
import { registerSessionCommands } from './commands/session.js';
import { registerConfigCommands } from './commands/config.js';
import { registerInitCommand } from './commands/init.js';
import { registerInstallCommand } from './commands/install.js';
import { registerManifestCommands } from './commands/manifest.js';
import { registerSkillsCommand } from './commands/skills.js';

// ── Program setup ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('tx')
  .description('tx — agentic workflow engine')
  .version(version, '-v, --version')
  .option('-a, --agent', 'JSON output (prints AgentResponse)', false)
  .option('-y, --yolo', 'skip confirmations', false);

// ── Global options accessor ───────────────────────────────────────────────────

// Evaluated lazily inside each command action — program.opts() is only
// populated after Commander has parsed the argv, so reading it at module level
// would always return the defaults.
function getAgent(): boolean {
  return (program.opts<{ agent: boolean }>().agent) ?? false;
}

// ── Daemon connection ────────────────────────────────────────────────────────

let clientPromise: Promise<TransportPort> | null = null;

/**
 * Return a TransportPort connected to the daemon.
 *
 * sock-daemon handles auto-start, stale detection, PID tracking, and retry
 * automatically. The first request triggers daemon spawn if needed.
 *
 * Cached per process — all commands share the same client.
 */
function ensureDaemon(): Promise<TransportPort> {
  if (!clientPromise) {
    clientPromise = createTxClient();
  }
  return clientPromise;
}

// ── Shared opts factory ───────────────────────────────────────────────────────

// Commands receive a `GlobalOpts` object. `agent` and `yolo` are read from
// program.opts() lazily inside each action; `getAdapter` calls ensureDaemon()
// which is also lazy (only runs when a command action fires).

function makeGlobalOpts() {
  return {
    get agent(): boolean {
      return (program.opts<{ agent: boolean }>().agent) ?? false;
    },
    get yolo(): boolean {
      return (program.opts<{ yolo: boolean }>().yolo) ?? false;
    },
    getAdapter: ensureDaemon,
  };
}

// ── Command registration ──────────────────────────────────────────────────────

const sharedOpts = makeGlobalOpts();

// `tx issue open/close/status`
registerIssueCommands(program, sharedOpts);

// `tx cycle start/pull/close`
registerCycleCommands(program, sharedOpts);

// `tx note`
registerNoteCommand(program, sharedOpts);

// `tx pickup` / `tx handoff` / `tx checkpoint` / `tx session status`
registerSessionCommands(program, sharedOpts);

// `tx config`
registerConfigCommands(program, sharedOpts);

// `tx skills` — local, no socket
registerSkillsCommand(program, {
  get agent(): boolean {
    return (program.opts<{ agent: boolean }>().agent) ?? false;
  },
  get yolo(): boolean {
    return (program.opts<{ yolo: boolean }>().yolo) ?? false;
  },
});

// `tx manifest write|show` — local, no socket
registerManifestCommands(program, {
  get agent(): boolean {
    return (program.opts<{ agent: boolean }>().agent) ?? false;
  },
  get yolo(): boolean {
    return (program.opts<{ yolo: boolean }>().yolo) ?? false;
  },
});

// `tx install [package]` — local, no socket; only needs agent/yolo flags
registerInstallCommand(program, {
  get agent(): boolean {
    return (program.opts<{ agent: boolean }>().agent) ?? false;
  },
  get yolo(): boolean {
    return (program.opts<{ yolo: boolean }>().yolo) ?? false;
  },
});

// `tx init` — local, no socket; only needs agent/yolo flags
registerInitCommand(program, {
  get agent(): boolean {
    return (program.opts<{ agent: boolean }>().agent) ?? false;
  },
  get yolo(): boolean {
    return (program.opts<{ yolo: boolean }>().yolo) ?? false;
  },
});

// ── tx next (top-level shorthand) ─────────────────────────────────────────────

program
  .command('next [slug]')
  .description('Advance the active issue one step (engine-driven)')
  .action(async (slug: string | undefined) => {
    setCurrentCommand('next');
    const agent = getAgent();
    const adapter = await ensureDaemon();

    // Resolve the active issue slug when none is provided.
    // Ask the daemon for a status overview and pick the first open issue.
    let issueSlug = slug;
    if (issueSlug === undefined) {
      const statusRes = await adapter.send({ command: 'status' });
      if (statusRes.status === 'ok') {
        // data is `unknown` — narrow to the expected status payload shape.
        const data = statusRes.data as { issues?: Array<{ issue: string; status: string }> } | null;
        const active = data?.issues?.find((i) => i.status === 'open');
        if (active !== undefined) {
          issueSlug = active.issue;
        }
      }
    }

    if (issueSlug === undefined) {
      await adapter.close();
      printError('No active issue found. Pass a slug: tx next <slug>', agent);
    }

    const res = await adapter.send({ command: 'next', issue_slug: issueSlug });
    await adapter.close();
    printResponse(res, agent);
  });

// ── Parse ─────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  printError(message, getAgent());
});
