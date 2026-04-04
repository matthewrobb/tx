import { Command } from 'commander';
import type { TransportPort } from '../../ports/transport.js';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
    getAdapter: () => Promise<TransportPort>;
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