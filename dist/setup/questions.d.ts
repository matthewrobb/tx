import type { AgentAction } from '../types/protocol.js';
export type SetupStep = 'welcome' | 'workflow_style' | 'skill_packages' | 'policies' | 'confirm';
export interface SetupAnswers {
    workflow_style: 'simple' | 'standard' | 'custom';
    install_packages: string[];
    enable_deferral_policy: boolean;
}
export interface SetupState {
    step: SetupStep;
    answers: Partial<SetupAnswers>;
}
/**
 * Return the AgentAction prompt for a given setup step.
 *
 * The welcome step is treated as a combined greeting + workflow_style question
 * (the user's first response is interpreted as the workflow style choice).
 * This reduces round-trips while keeping the state machine clean.
 */
export declare function getPrompt(step: SetupStep, state: SetupState): AgentAction;
//# sourceMappingURL=questions.d.ts.map