import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
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
export declare function registerConfigCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=config.d.ts.map