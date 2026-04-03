import { Command } from 'commander';
import type { SocketTransportAdapter } from '../../adapters/socket/client.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<SocketTransportAdapter>;
}
/**
 * Register the `tx note` command onto `program`.
 *
 * Usage:
 *   tx note "<summary>" [--decide] [--defer] [--discover] [--blocker] [--retro]
 *                       [-e <issue-slug>]
 *
 * Tag flags are additive — multiple flags can be set simultaneously.
 */
export declare function registerNoteCommand(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=note.d.ts.map