// src/cli/commands/config.ts — `tx config` command for v4 CLI.
//
// Fetches the merged config from the daemon (status command returns it) and
// displays it. The daemon owns config resolution in v4; we do not read
// settings.json directly in the CLI.
//
// NOTE: This file replaces the v3 config.ts. The v3 implementation responded
// with a locally-resolved config; v4 asks the daemon for the canonical view.
import { printResponse, setCurrentCommand } from '../output.js';
import { mergeIntoSettings } from './config-merge.js';
/**
 * Register the `tx config` and `tx config merge` commands onto `program`.
 */
export function registerConfigCommands(program, opts) {
    const config = program
        .command('config')
        .description('Configuration management');
    // tx config show (default action)
    config
        .command('show', { isDefault: true })
        .description('Show current configuration')
        .action(async () => {
        setCurrentCommand('config');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({ command: 'status' });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // tx config merge — reads JSON from stdin, deep-merges into settings.json
    config
        .command('merge')
        .description('Deep-merge JSON from stdin into .twisted/settings.json')
        .action(async () => {
        const cwd = process.cwd();
        // Read JSON from stdin.
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString('utf-8').trim();
        if (input.length === 0) {
            const msg = 'No input on stdin. Pipe JSON: echo \'{"step_skills":{"build":"@pkg/tdd"}}\' | tx config merge';
            if (opts.agent) {
                console.log(JSON.stringify({ status: 'error', command: 'config merge', error: msg }));
            }
            else {
                console.error(msg);
            }
            process.exitCode = 1;
            return;
        }
        let patch;
        try {
            patch = JSON.parse(input);
        }
        catch {
            const msg = 'Invalid JSON on stdin.';
            if (opts.agent) {
                console.log(JSON.stringify({ status: 'error', command: 'config merge', error: msg }));
            }
            else {
                console.error(msg);
            }
            process.exitCode = 1;
            return;
        }
        const merged = await mergeIntoSettings(cwd, patch);
        if (opts.agent) {
            console.log(JSON.stringify({
                status: 'ok',
                command: 'config merge',
                display: 'Settings updated.',
                data: merged,
            }));
        }
        else {
            console.log('Settings updated.');
        }
    });
}
//# sourceMappingURL=config.js.map