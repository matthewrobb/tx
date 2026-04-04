import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<TransportPort>;
}
/**
 * Register the `tx config` and `tx config merge` commands onto `program`.
 */
export declare function registerConfigCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=config.d.ts.map