import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
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
export declare function registerIssueCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=issue.d.ts.map