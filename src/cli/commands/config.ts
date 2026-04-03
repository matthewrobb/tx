// src/cli/commands/config.ts — `tx config` command for v4 CLI.
//
// Fetches the merged config from the daemon (status command returns it) and
// displays it. The daemon owns config resolution in v4; we do not read
// settings.json directly in the CLI.
//
// NOTE: This file replaces the v3 config.ts. The v3 implementation responded
// with a locally-resolved config; v4 asks the daemon for the canonical view.

import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
import { printResponse, setCurrentCommand } from '../output.js';

export interface GlobalOpts {
  agent: boolean;
  yolo: boolean;
  getAdapter: () => Promise<SocketTransportAdapter>;
}

/**
 * Register the `tx config` command onto `program`.
 *
 * Usage:
 *   tx config
 *
 * Sends a generic status request; the daemon includes the current resolved
 * config in the response payload.
 */
export function registerConfigCommands(program: Command, opts: GlobalOpts): void {
  program
    .command('config')
    .description('Show current configuration')
    .action(async () => {
      setCurrentCommand('config');
      const adapter = await opts.getAdapter();
      const res = await adapter.send({ command: 'status' });
      await adapter.close();
      printResponse(res, opts.agent);
    });
}
