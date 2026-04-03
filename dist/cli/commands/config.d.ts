import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<SocketTransportAdapter>;
}
/**
 * Register the `tx config` and `tx config merge` commands onto `program`.
 */
export declare function registerConfigCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=config.d.ts.map