import type { TwistedConfig } from '../types/config.js';
import type { AgentAction } from '../types/protocol.js';
import type { SetupState } from './questions.js';
export interface InitInput {
    /** Current state of setup (undefined = starting fresh). */
    state?: SetupState;
    /** User's response to the last prompt (undefined on first call). */
    response?: string;
    /** Project directory for writing .twisted/settings.json. */
    cwd: string;
}
export type InitResult = {
    status: 'prompting';
    action: AgentAction;
    state: SetupState;
} | {
    status: 'complete';
    config: TwistedConfig;
    settingsPath: string;
} | {
    status: 'error';
    message: string;
};
/**
 * Run one turn of the guided setup conversation.
 *
 * Called once per user interaction.  Returns either:
 *   - { status: 'prompting' } — next question for the user
 *   - { status: 'complete' }  — settings.json written, setup done
 *   - { status: 'error' }     — something went wrong
 */
export declare function runInit(input: InitInput): Promise<InitResult>;
//# sourceMappingURL=init.d.ts.map