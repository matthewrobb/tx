// src/setup/questions.ts — Setup step definitions, state types, and prompt generators.
//
// The setup flow is a 5-step conversation between the agent and the user.
// Each step produces an AgentAction that the CLI surfaces to the user.
// Responses are stored in SetupState.answers and carried forward between calls.
// ---------------------------------------------------------------------------
// Prompt generators — one per step
// ---------------------------------------------------------------------------
/**
 * Return the AgentAction prompt for a given setup step.
 *
 * The welcome step is treated as a combined greeting + workflow_style question
 * (the user's first response is interpreted as the workflow style choice).
 * This reduces round-trips while keeping the state machine clean.
 */
export function getPrompt(step, state) {
    switch (step) {
        case 'welcome':
        case 'workflow_style':
            return {
                type: 'prompt_user',
                prompt: 'Welcome to twisted-workflow v4! How would you like to set up your workflow?\n\n' +
                    '- simple: single "feature" workflow (research → scope → plan → build)\n' +
                    '- standard: feature + bug + chore + spike workflows\n' +
                    '- custom: define your own workflows',
                categories: ['simple', 'standard', 'custom'],
            };
        case 'skill_packages':
            return {
                type: 'prompt_user',
                prompt: 'Would you like to install any skill packages? ' +
                    '(comma-separated npm names, or leave blank to skip)',
            };
        case 'policies':
            return {
                type: 'confirm',
                message: 'Enable deferral approval policy? When enabled, the engine pauses and asks ' +
                    'for confirmation before deferring any step.',
                next_command: 'init --policies-yes',
            };
        case 'confirm': {
            const summary = buildConfigSummary(state.answers);
            return {
                type: 'confirm',
                message: `Ready to write .twisted/settings.json with this configuration:\n\n${summary}`,
                next_command: 'init --confirm',
            };
        }
    }
}
// ---------------------------------------------------------------------------
// Config summary formatter (used in confirm prompt)
// ---------------------------------------------------------------------------
/**
 * Build a human-readable summary of the answers gathered so far.
 * Used in the final confirm prompt so the user can review before writing.
 */
function buildConfigSummary(answers) {
    const lines = [];
    lines.push(`Workflow style: ${answers.workflow_style ?? '(not set)'}`);
    const pkgs = answers.install_packages ?? [];
    lines.push(`Skill packages: ${pkgs.length > 0 ? pkgs.join(', ') : '(none)'}`);
    lines.push(`Deferral policy: ${answers.enable_deferral_policy === true ? 'enabled (confirm before deferral)' : 'disabled'}`);
    return lines.join('\n');
}
//# sourceMappingURL=questions.js.map