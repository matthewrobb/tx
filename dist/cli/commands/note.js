// src/cli/commands/note.ts — `tx note` command for v4 CLI.
//
// Notes are typed annotations attached to the session or a specific issue.
// Exactly one tag flag should be set; if none are set the note is untagged
// (still valid — the daemon accepts an empty tags array).
import { printResponse, setCurrentCommand } from '../output.js';
/**
 * Register the `tx note` command onto `program`.
 *
 * Usage:
 *   tx note "<summary>" [--decide] [--defer] [--discover] [--blocker] [--retro]
 *                       [-e <issue-slug>]
 *
 * Tag flags are additive — multiple flags can be set simultaneously.
 */
export function registerNoteCommand(program, opts) {
    program
        .command('note <summary>')
        .description('Add a typed note')
        .option('--decide', 'tag as a decision')
        .option('--defer', 'tag as a deferral')
        .option('--discover', 'tag as a discovery')
        .option('--blocker', 'tag as a blocker')
        .option('--retro', 'tag as a retro item')
        .option('-e, --epic <slug>', 'attach to a specific issue by slug')
        .action(async (summary, cmdOpts) => {
        setCurrentCommand('note');
        // Build the tags array from whichever flags are truthy.
        const tags = [];
        if (cmdOpts.decide)
            tags.push('decide');
        if (cmdOpts.defer)
            tags.push('defer');
        if (cmdOpts.discover)
            tags.push('discover');
        if (cmdOpts.blocker)
            tags.push('blocker');
        if (cmdOpts.retro)
            tags.push('retro');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({
            command: 'note',
            summary,
            tags,
            issue_slug: cmdOpts.epic,
        });
        await adapter.close();
        printResponse(res, opts.agent);
    });
}
//# sourceMappingURL=note.js.map