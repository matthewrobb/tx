// src/cli/commands/cycle.ts — `tx cycle` subcommands for v4 CLI.
//
// Cycles group related issues into a named iteration (sprint-like). The daemon
// handles the persistence; the CLI just marshals the arguments to DaemonRequests.
//
// Cycle handlers in the daemon are stubbed (S-021). These commands send the
// correct protocol messages and surface whatever the daemon returns.
import { printResponse, setCurrentCommand } from '../output.js';
/**
 * Register all `tx cycle` subcommands onto `program`.
 *
 * Commands:
 *   tx cycle start <slug> [--title <title>] [--description <desc>]
 *   tx cycle pull [slug...]
 *   tx cycle close [--summary <text>]
 */
export function registerCycleCommands(program, opts) {
    const cycle = program.command('cycle').description('Manage cycles (iterations)');
    // ── start ────────────────────────────────────────────────────────────────────
    cycle
        .command('start <slug>')
        .description('Start a new cycle')
        .option('--title <title>', 'cycle title (defaults to slug)')
        .option('--description <desc>', 'optional description')
        .action(async (slug, cmdOpts) => {
        setCurrentCommand('cycle start');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({
            command: 'cycle_start',
            slug,
            title: cmdOpts.title ?? slug,
            description: cmdOpts.description,
        });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // ── pull ─────────────────────────────────────────────────────────────────────
    cycle
        .command('pull [slugs...]')
        .description('Pull one or more issues into the active cycle')
        .action(async (slugs) => {
        setCurrentCommand('cycle pull');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({
            command: 'cycle_pull',
            issue_slugs: slugs,
        });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // ── close ─────────────────────────────────────────────────────────────────────
    cycle
        .command('close')
        .description('Close the active cycle')
        .option('--summary <text>', 'retrospective summary for this cycle', '')
        .action(async (cmdOpts) => {
        setCurrentCommand('cycle close');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({
            command: 'cycle_close',
            summary: cmdOpts.summary,
        });
        await adapter.close();
        printResponse(res, opts.agent);
    });
}
//# sourceMappingURL=cycle.js.map