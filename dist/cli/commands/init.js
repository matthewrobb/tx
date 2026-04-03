// src/cli/commands/init.ts — `tx init` command for v4 CLI.
//
// `tx init` is the ONLY command that does NOT send a DaemonRequest. It runs
// the guided setup conversation locally (no daemon needed — the daemon may not
// exist yet when init is called) and writes .twisted/settings.json to disk.
//
// Multi-turn flow:
//   1. First call (no --state): runInit() returns status:'prompting' with the
//      first question. We print the prompt and exit with a non-zero code so the
//      shell/agent knows to re-invoke with --response.
//   2. Each subsequent call: --state carries the serialised SetupState JSON,
//      --response carries the user's answer. We advance the machine.
//   3. When status:'complete': print success and exit 0.
import { runInit } from '../../setup/init.js';
import { printError } from '../output.js';
/**
 * Register the `tx init` command onto `program`.
 *
 * Usage:
 *   tx init
 *   tx init --response "standard" --state '<json>'
 */
export function registerInitCommand(program, opts) {
    program
        .command('init')
        .description('Guided project setup — writes .twisted/settings.json')
        .option('--response <text>', 'user response to the last prompt (for multi-turn)')
        .option('--state <json>', 'serialised SetupState from the previous turn')
        .action(async (cmdOpts) => {
        // Deserialise the state from the previous turn, if any.
        let state;
        if (cmdOpts.state !== undefined) {
            try {
                // `unknown` narrowed immediately — we trust the shape at compile time
                // because the CLI only emits valid SetupState JSON (see below).
                state = JSON.parse(cmdOpts.state);
            }
            catch {
                printError('Invalid --state JSON. Pass the exact value printed by the previous tx init call.', opts.agent);
            }
        }
        const result = await runInit({
            cwd: process.cwd(),
            state,
            response: cmdOpts.response,
        });
        switch (result.status) {
            case 'prompting': {
                // Print the next question for the user.
                const action = result.action;
                let prompt;
                if (action.type === 'prompt_user') {
                    prompt = action.prompt;
                    if (action.categories && action.categories.length > 0) {
                        prompt += `\nOptions: ${action.categories.join(', ')}`;
                    }
                }
                else {
                    // Fallback for any other action type returned during init
                    prompt = JSON.stringify(action);
                }
                process.stdout.write(prompt + '\n\n');
                process.stdout.write(`Re-run with: tx init --state '${JSON.stringify(result.state)}' --response "<your answer>"\n`);
                // Exit non-zero to signal the conversation is not complete.
                process.exit(2);
            }
            case 'complete': {
                process.stdout.write(`Setup complete. Settings written to: ${result.settingsPath}\n`);
                // Show the resolved config so the user can verify their choices.
                process.stdout.write(JSON.stringify(result.config, null, 2) + '\n');
                break;
            }
            case 'error': {
                printError(result.message, opts.agent);
            }
        }
    });
}
//# sourceMappingURL=init.js.map