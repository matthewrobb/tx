import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<TransportPort>;
}
/**
 * Register session-related commands onto `program`.
 *
 * Commands registered as top-level for convenience:
 *   tx pickup [name]
 *   tx handoff
 *   tx checkpoint "<summary>"
 *
 * Commands under `tx session` subgroup:
 *   tx session status
 */
export declare function registerSessionCommands(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=session.d.ts.map