import { Command } from 'commander';
export interface GlobalOpts {
    agent: boolean;
    yolo: boolean;
}
/**
 * Register the `tx init` command onto `program`.
 *
 * Usage:
 *   tx init
 *   tx init --response "standard" --state '<json>'
 */
export declare function registerInitCommand(program: Command, opts: GlobalOpts): void;
//# sourceMappingURL=init.d.ts.map