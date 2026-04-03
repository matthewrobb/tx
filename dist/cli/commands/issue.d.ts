import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<SocketTransportAdapter>;
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
export declare function registerIssueCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=issue.d.ts.map