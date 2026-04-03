import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<SocketTransportAdapter>;
}
/**
 * Register all `tx cycle` subcommands onto `program`.
 *
 * Commands:
 *   tx cycle start <slug> [--title <title>] [--description <desc>]
 *   tx cycle pull [slug...]
 *   tx cycle close [--summary <text>]
 */
export declare function registerCycleCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=cycle.d.ts.map