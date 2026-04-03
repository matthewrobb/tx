#!/usr/bin/env node
// src/cli/index.ts — v4 entry point: thin socket client.
//
// Every command (except `tx init`) sends a DaemonRequest over a Unix socket
// and prints the DaemonResponse. No business logic lives here. The daemon owns
// all state, config resolution, and workflow execution.
//
// E2E tests (S-027) cover CLI behaviour end-to-end with a live daemon.
// Unit-testing this file in isolation is impractical: it requires a live socket
// and daemon process. Mock-based tests would only validate the mock.
//
// Auto-start:
//   Before the first socket send, ensureDaemon() checks whether the daemon is
//   reachable. If not, it calls startDaemon() and retries 3 times with 500 ms
//   delays before giving up.

import { Command } from 'commander';

import { SocketTransportAdapter } from '../adapters/socket/client.js';
import { startDaemon } from '../daemon/server.js';
import { printError, printResponse, setCurrentCommand } from './output.js';

import { registerIssueCommands } from './commands/issue.js';
import { registerCycleCommands } from './commands/cycle.js';
import { registerNoteCommand } from './commands/note.js';
import { registerSessionCommands } from './commands/session.js';
import { registerConfigCommands } from './commands/config.js';
import { registerInitCommand } from './commands/init.js';

// ── Program setup ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('tx')
  .description('twisted-workflow CLI')
  .version('4.1.0', '-v, --version')
  .option('-a, --agent', 'JSON output (prints AgentResponse)', false)
  .option('-y, --yolo', 'skip confirmations', false);

// ── Global options accessor ───────────────────────────────────────────────────

// Evaluated lazily inside each command action — program.opts() is only
// populated after Commander has parsed the argv, so reading it at module level
// would always return the defaults.
function getAgent(): boolean {
  return (program.opts<{ agent: boolean }>().agent) ?? false;
}

// ── Daemon auto-start ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return a connected SocketTransportAdapter.
 *
 * If the daemon is not reachable, auto-start it via startDaemon() and retry
 * up to 3 times with 500 ms delays before giving up.
 *
 * This function is called lazily — only when a command actually needs the
 * socket. `tx init` bypasses it entirely.
 */
async function ensureDaemon(): Promise<SocketTransportAdapter> {
  // Probe: attempt a connection with a short timeout.
  const probe = new SocketTransportAdapter({ timeoutMs: 2_000 });
  const probeRes = await probe.send({ command: 'status' });
  await probe.close();

  if (probeRes.status !== 'error') {
    // Daemon is already running — return a fresh adapter for actual use.
    return new SocketTransportAdapter();
  }

  // Daemon is not running — start it.
  try {
    await startDaemon(process.cwd());
  } catch (err) {
    printError(
      `Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`,
      getAgent(),
    );
  }

  // Retry up to 3 times with 500 ms delays to wait for the daemon to bind.
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await sleep(RETRY_DELAY_MS);

    const retryAdapter = new SocketTransportAdapter({ timeoutMs: 2_000 });
    const retryRes = await retryAdapter.send({ command: 'status' });

    if (retryRes.status !== 'error') {
      // Ready — close the probe and hand back a clean adapter.
      await retryAdapter.close();
      return new SocketTransportAdapter();
    }

    await retryAdapter.close();
  }

  printError(
    `Daemon did not become ready after ${MAX_RETRIES} retries. Check .twisted/data/ for errors.`,
    getAgent(),
  );
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
