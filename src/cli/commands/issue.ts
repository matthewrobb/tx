// src/cli/commands/issue.ts — `tx issue` subcommands for v4 CLI.
//
// All commands are thin: they build a DaemonRequest, send it via the adapter,
// and hand the DaemonResponse to printResponse(). No business logic lives here.

import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
import { printResponse, printError, setCurrentCommand } from '../output.js';
import type { IssueType } from '../../types/issue.js';

export interface GlobalOpts {
  agent: boolean;
  yolo: boolean;
  getAdapter: () => Promise<TransportPort>;
}

/**
 * Register all `tx issue` subcommands onto `program`.
 *
 * Commands:
 *   tx issue open <slug> [--type <type>] [--title <title>]
 *   tx issue close <slug>
 *   tx issue status [slug]
 *
 * The `tx next` shorthand lives in index.ts (top-level command).
 */
export function registerIssueCommands(program: Command, opts: GlobalOpts): void {
  const issue = program.command('issue').description('Manage issues');

  // ── open ────────────────────────────────────────────────────────────────────

  issue
    .command('open <slug>')
    .description('Create a new issue')
    .option('--type <type>', 'issue type (feature|bug|spike|chore|release)', 'feature')
    .option('--title <title>', 'human-readable title (defaults to slug)')
    .action(async (slug: string, cmdOpts: { type?: string; title?: string }) => {
      setCurrentCommand('issue open');
      const adapter = await opts.getAdapter();

      // Validate IssueType at the CLI boundary — the daemon accepts the typed
      // union but we can surface a clear error message here before the round-trip.
      const validTypes: IssueType[] = ['feature', 'bug', 'spike', 'chore', 'release'];
      const type = (cmdOpts.type ?? 'feature') as IssueType;
      if (!validTypes.includes(type)) {
        printError(
          `Invalid type "${String(cmdOpts.type)}". Valid: ${validTypes.join(', ')}`,
          opts.agent,
        );
      }

      const res = await adapter.send({
        command: 'open',
        slug,
        type,
        title: cmdOpts.title ?? slug,
      });
      await adapter.close();
      printResponse(res, opts.agent);
    });

  // ── close ───────────────────────────────────────────────────────────────────

  issue
    .command('close <slug>')
    .description('Close an issue')
    .action(async (slug: string) => {
      setCurrentCommand('issue close');
      const adapter = await opts.getAdapter();
      const res = await adapter.send({ command: 'close', issue_slug: slug });
      await adapter.close();
      printResponse(res, opts.agent);
    });

  // ── status ──────────────────────────────────────────────────────────────────

  issue
    .command('status [slug]')
    .description('Show status for one or all issues')
    .action(async (slug: string | undefined) => {
      setCurrentCommand('issue status');
      const adapter = await opts.getAdapter();
      const res = await adapter.send({ command: 'status', issue_slug: slug });
      await adapter.close();
      printResponse(res, opts.agent);
    });
}
