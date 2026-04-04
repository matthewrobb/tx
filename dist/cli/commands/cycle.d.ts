import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<TransportPort>;
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