// src/cli/commands/session.ts — session lifecycle commands for v4 CLI.
//
// Sessions track a working period. pickup starts one, handoff ends it.
// Checkpoints add mid-session progress markers.
//
// NOTE: This file replaces the v3 session.ts. The v3 implementation relied on
// direct filesystem reads; v4 delegates all state to the daemon via DaemonRequest.
import { printResponse, setCurrentCommand } from '../output.js';
/**
 * Register session-related commands onto `program`.
 *
 * Commands registered as top-level for convenience:
 *   tx pickup [name]
 *   tx handoff
 *   tx checkpoint "<summary>"
 *
 * Commands under `tx session` subgroup:
 *   tx session status
 */
export function registerSessionCommands(program, opts) {
    // ── pickup ──────────────────────────────────────────────────────────────────
    program
        .command('pickup [name]')
        .description('Start a new session')
        .action(async (name) => {
        setCurrentCommand('pickup');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({ command: 'pickup', name });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // ── handoff ─────────────────────────────────────────────────────────────────
    program
        .command('handoff')
        .description('End the current session')
        .action(async () => {
        setCurrentCommand('handoff');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({ command: 'handoff' });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // ── checkpoint ──────────────────────────────────────────────────────────────
    program
        .command('checkpoint <summary>')
        .description('Add a checkpoint to the current session')
        .action(async (summary) => {
        setCurrentCommand('checkpoint');
        const adapter = await opts.getAdapter();
        const res = await adapter.send({ command: 'checkpoint', summary });
        await adapter.close();
        printResponse(res, opts.agent);
    });
    // ── session subgroup ────────────────────────────────────────────────────────
    const session = program.command('session').description('Session management');
    session
        .command('status')
        .description('Show active session info')
        .action(async () => {
        setCurrentCommand('session status');
        const adapter = await opts.getAdapter();
        // Reuse the generic status command — the daemon returns session data
        // as part of the status payload when no issue_slug is given.
        const res = await adapter.send({ command: 'status' });
        await adapter.close();
        printResponse(res, opts.agent);
    });
}
//# sourceMappingURL=session.js.map