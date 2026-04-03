// src/setup/init.ts — Guided tx init setup orchestrator.
//
// runInit() drives a multi-turn conversational setup flow.  The caller
// (CLI or agent) passes the accumulated SetupState and the user's latest
// response; runInit() returns either the next AgentAction prompt or, once
// the user confirms, writes .twisted/settings.json and returns complete.
//
// State machine:
//   undefined → 'welcome' → 'workflow_style' → 'skill_packages'
//             → 'policies' → 'confirm' → complete
//
// Design note: 'welcome' and 'workflow_style' collapse into a single round-trip.
// The first call (no state) returns the welcome/workflow_style prompt.
// The response to that prompt is parsed as the workflow_style answer, and the
// machine advances to 'skill_packages' in the same call that processes the reply.
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { resolveConfig } from '../config/resolve.js';
import { getPrompt } from './questions.js';
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * Run one turn of the guided setup conversation.
 *
 * Called once per user interaction.  Returns either:
 *   - { status: 'prompting' } — next question for the user
 *   - { status: 'complete' }  — settings.json written, setup done
 *   - { status: 'error' }     — something went wrong
 */
export async function runInit(input) {
    const { state, response, cwd } = input;
    // ── First call: no state yet ─────────────────────────────────────────────
    if (state === undefined) {
        const initial = { step: 'welcome', answers: {} };
        return {
            status: 'prompting',
            action: getPrompt('welcome', initial),
            state: initial,
        };
    }
    // ── Subsequent calls: process the response and advance ──────────────────
    const result = processResponse(state, response);
    if (result.status === 'error')
        return result;
    const nextState = result.state;
    // ── If the current step WAS 'confirm' and response is affirmative, write + complete.
    // We check state.step (the step the user just responded to), not nextState.step
    // (the next step we would advance to). This avoids mistaking an affirmative
    // answer to the 'policies' question as a confirmation of the final config.
    if (state.step === 'confirm' && isAffirmative(response)) {
        return await finalize(state.answers, cwd);
    }
    // ── Otherwise return the next prompt ────────────────────────────────────
    return {
        status: 'prompting',
        action: getPrompt(nextState.step, nextState),
        state: nextState,
    };
}
/**
 * Process the user's response to the current step and return the updated state.
 *
 * Each case:
 *   1. Parses/validates the response for the current step
 *   2. Records the answer
 *   3. Advances the step pointer
 */
function processResponse(state, response) {
    const answers = { ...state.answers };
    switch (state.step) {
        case 'welcome':
        case 'workflow_style': {
            const style = parseWorkflowStyle(response ?? '');
            if (style === null) {
                return {
                    status: 'error',
                    message: `Invalid workflow style "${response ?? ''}". ` +
                        'Expected one of: simple, standard, custom.',
                };
            }
            answers.workflow_style = style;
            return { status: 'ok', state: { step: 'skill_packages', answers } };
        }
        case 'skill_packages': {
            answers.install_packages = parsePackageList(response ?? '');
            return { status: 'ok', state: { step: 'policies', answers } };
        }
        case 'policies': {
            // The policies step is a confirm prompt — any affirmative response enables it.
            answers.enable_deferral_policy = isAffirmative(response);
            return { status: 'ok', state: { step: 'confirm', answers } };
        }
        case 'confirm': {
            // If the user says no at confirm, we restart from workflow_style.
            // If yes, the caller handles finalization (checked before this function).
            if (isAffirmative(response)) {
                // Caller handles this case — return unchanged state so caller can finalize.
                return { status: 'ok', state };
            }
            // User declined — restart from the beginning
            return { status: 'ok', state: { step: 'welcome', answers: {} } };
        }
    }
}
// ---------------------------------------------------------------------------
// Finalization — write settings.json and return complete
// ---------------------------------------------------------------------------
async function finalize(answers, cwd) {
    try {
        const settings = buildSettings(answers);
        const config = resolveConfig(settings);
        const twistedDir = path.join(cwd, '.twisted');
        await mkdir(twistedDir, { recursive: true });
        const settingsPath = path.join(twistedDir, 'settings.json');
        const schemaAbsolute = path.resolve(import.meta.dirname, '../../schemas/settings.schema.json');
        const schemaRelative = path.relative(twistedDir, schemaAbsolute);
        const withSchema = { $schema: schemaRelative, ...settings };
        await writeFile(settingsPath, JSON.stringify(withSchema, null, 2), 'utf-8');
        return { status: 'complete', config, settingsPath };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'error', message: `Failed to write settings: ${message}` };
    }
}
// ---------------------------------------------------------------------------
// Settings generation — translates SetupAnswers to TwistedSettings
// ---------------------------------------------------------------------------
/**
 * Build a minimal TwistedSettings from setup answers.
 *
 * Generates the smallest valid settings that captures the user's choices:
 *   - simple  → explicit single-workflow override (only feature)
 *   - standard → empty settings (all defaults apply, all 4 built-in workflows)
 *   - custom   → placeholder workflows array (user fills in their definitions)
 *
 * Deferral policy appends a policies block only when enabled.
 */
function buildSettings(answers) {
    const style = answers.workflow_style ?? 'standard';
    // Base settings depend on workflow style
    let settings;
    if (style === 'simple') {
        // Only the feature workflow — override the workflows array to exclude others.
        // The resolver will keep built-ins not mentioned, so we explicitly set the
        // full workflows list to signal "just the feature workflow is wanted."
        //
        // Implementation: store only the feature workflow entry in settings. The
        // resolver's mergeWorkflows will replace the default list with this one
        // since the user provides an explicit workflows array.
        settings = {
            version: '4.0',
            workflows: [
                {
                    id: 'feature',
                    title: 'Feature',
                    default_for: ['feature'],
                    steps: [
                        { id: 'research', title: 'Research', needs: [] },
                        { id: 'scope', title: 'Scope', needs: ['research'] },
                        { id: 'plan', title: 'Plan', needs: ['scope'] },
                        { id: 'build', title: 'Build', needs: ['plan'] },
                    ],
                },
            ],
        };
    }
    else if (style === 'custom') {
        // Placeholder — user will fill in their workflow definitions.
        // We write an empty workflows array and a comment hint in the generated file
        // by including a minimal structure the user can extend.
        settings = {
            version: '4.0',
            workflows: [],
        };
    }
    else {
        // standard: all built-in defaults apply — settings only needs the version
        settings = { version: '4.0' };
    }
    // Append deferral policy when enabled
    if (answers.enable_deferral_policy === true) {
        settings = {
            ...settings,
            policies: {
                deferral: "confirm('Defer this step?')",
            },
        };
    }
    return settings;
}
// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
/**
 * Parse a workflow style from a free-text response.
 * Accepts the exact values 'simple', 'standard', 'custom' (case-insensitive).
 * Returns null if the response doesn't match any valid value.
 */
function parseWorkflowStyle(response) {
    const trimmed = response.trim().toLowerCase();
    if (trimmed === 'simple' || trimmed === 'standard' || trimmed === 'custom') {
        return trimmed;
    }
    return null;
}
/**
 * Parse a comma-separated list of npm package names.
 * Empty or whitespace-only input returns an empty array.
 * Each name is trimmed of surrounding whitespace; blank segments are removed.
 */
function parsePackageList(response) {
    if (response.trim() === '')
        return [];
    return response
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
/**
 * Determine whether a free-text response is affirmative.
 * Accepts: yes, y, true, confirm, ok (case-insensitive).
 * Everything else — including undefined/empty — is treated as negative.
 */
function isAffirmative(response) {
    if (response === undefined)
        return false;
    const t = response.trim().toLowerCase();
    return t === 'yes' || t === 'y' || t === 'true' || t === 'confirm' || t === 'ok';
}
//# sourceMappingURL=init.js.map