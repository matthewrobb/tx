// src/cli/output.ts — Format DaemonResponse for human display or --agent JSON.
//
// Two output modes:
//   Human mode:  prints formatted text designed for a terminal.
//   Agent mode:  prints a JSON AgentResponse for a Claude orchestrator to parse.
//
// The AgentResponse wrapper normalises the DaemonResponse shape so that callers
// never need to switch on DaemonResponse.status themselves.

import type { DaemonResponse, AgentResponse, AgentAction, IssueState } from '../types/protocol.js';

// ── Module-level state ────────────────────────────────────────────────────────

// Tracks the current command name for inclusion in AgentResponse.
// Set by index.ts before dispatching a command.
let _currentCommand = 'tx';

/** Set the command name used in AgentResponse.command for the current invocation. */
export function setCurrentCommand(name: string): void {
  _currentCommand = name;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format a DaemonResponse for human-readable output.
 *
 * The formatted string is returned, not printed, so callers can pipe it or
 * include it in an AgentResponse.display field.
 */
export function formatResponse(res: DaemonResponse, agentMode: boolean): string {
  if (agentMode) {
    return JSON.stringify(buildAgentResponse(res), null, 2);
  }
  return formatHuman(res);
}

/**
 * Print the formatted response to stdout.
 *
 * In agent mode the full AgentResponse JSON is printed.
 * In human mode the plain display text is printed.
 */
export function printResponse(res: DaemonResponse, agentMode: boolean): void {
  process.stdout.write(formatResponse(res, agentMode) + '\n');
}

/**
 * Print an error message and exit with code 1.
 *
 * In agent mode the error is wrapped in an AgentResponse so the caller always
 * receives valid JSON.
 *
 * Declared as `never` because it always exits — this propagates into callers
 * and avoids requiring explicit `return` after a `printError()` call.
 */
export function printError(message: string, agentMode: boolean): never {
  const errorRes: DaemonResponse = { status: 'error', message };
  process.stdout.write(formatResponse(errorRes, agentMode) + '\n');
  process.exit(1);
}

// ── Human formatting ──────────────────────────────────────────────────────────

function formatHuman(res: DaemonResponse): string {
  if (res.status === 'error') {
    return `Error: ${res.message}${res.code ? ` (${res.code})` : ''}`;
  }

  if (res.status === 'paused') {
    return formatAction(res.prompt);
  }

  // status === 'ok' — inspect the data shape to produce a friendly display.
  // data is `unknown` by design (protocol.ts comment explains why); we narrow
  // it here at the display layer where we actually need the shape.
  return formatOkData(res.data);
}

function formatAction(action: AgentAction): string {
  switch (action.type) {
    case 'confirm':
      return `${action.message}\n\nRun: ${action.next_command}`;
    case 'prompt_user':
      return action.prompt;
    case 'invoke_skill':
      return `Invoke skill: ${action.skill}${action.prompt ? `\n${action.prompt}` : ''}`;
    case 'run_agents': {
      const lines = action.agents.map(
        (a) => `  [${a.model}] ${a.story}: ${a.prompt}`,
      );
      return `Run agents:\n${lines.join('\n')}`;
    }
    case 'install_cli':
      return `Install CLI:\n${action.instructions}`;
    case 'done':
      return 'Done.';
  }
}

/**
 * Format the `data` payload from a successful DaemonResponse.
 *
 * The data field is `unknown` at the type level — we inspect its shape at
 * runtime to produce a sensible human-readable string. Unknown shapes fall
 * back to JSON serialization.
 */
function formatOkData(data: unknown): string {
  if (data === null || data === undefined) return 'OK';

  if (typeof data === 'string') return data;

  // Structured responses from the daemon carry a `kind` discriminant.
  if (typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;

    // Status response — list of IssueState objects
    if (Array.isArray(d['issues'])) {
      return formatIssueList(d['issues'] as IssueState[]);
    }

    // Single IssueState snapshot
    if (typeof d['issue'] === 'string' && typeof d['step'] === 'string') {
      return formatIssueState(d as unknown as IssueState);
    }

    // Next/advance response
    if (typeof d['advanced'] === 'boolean') {
      if (d['advanced'] === false) return 'Already at the last step — nothing to advance.';
      const from = typeof d['from'] === 'string' ? d['from'] : '?';
      const to = typeof d['to'] === 'string' ? d['to'] : '?';
      return `Advanced: ${from} → ${to}`;
    }

    // Open response
    if (typeof d['slug'] === 'string' && typeof d['type'] === 'string') {
      return `Created: ${d['slug']} (${d['type']})`;
    }

    // Close response
    if (typeof d['closed'] === 'boolean' && d['closed']) {
      const slug = typeof d['slug'] === 'string' ? d['slug'] : '';
      return `Closed: ${slug}`;
    }

    // Note response
    if (typeof d['note_id'] === 'string' || d['note'] === true) {
      return 'Note added.';
    }

    // Session responses
    if (typeof d['session'] === 'object' && d['session'] !== null) {
      return formatSession(d['session'] as Record<string, unknown>);
    }

    // Checkpoint response
    if (typeof d['checkpoint'] === 'string') {
      return `Checkpoint: ${d['checkpoint']}`;
    }

    // Config response
    if (typeof d['version'] === 'string') {
      return JSON.stringify(data, null, 2);
    }
  }

  // Fallback: pretty-print JSON
  return JSON.stringify(data, null, 2);
}

function formatIssueList(issues: IssueState[]): string {
  if (issues.length === 0) return 'No issues.';

  const header = `${'ISSUE'.padEnd(24)}  ${'TYPE'.padEnd(10)}  ${'STEP'.padEnd(16)}  STATUS`;
  const sep = '-'.repeat(header.length);
  const rows = issues.map(
    (i) =>
      `${i.issue.padEnd(24)}  ${i.type.padEnd(10)}  ${i.step.padEnd(16)}  ${i.status}`,
  );
  return [header, sep, ...rows].join('\n');
}

function formatIssueState(i: IssueState): string {
  const tasks =
    i.tasks_total !== null
      ? `${i.tasks_done}/${i.tasks_total} tasks`
      : 'no tasks';
  return [
    `Issue:   ${i.issue}`,
    `Type:    ${i.type}`,
    `Workflow:${i.workflow_id}`,
    `Step:    ${i.step}`,
    `Status:  ${i.status}`,
    `Tasks:   ${tasks}`,
    `Updated: ${i.updated}`,
  ].join('\n');
}

function formatSession(s: Record<string, unknown>): string {
  if (typeof s['number'] === 'number') {
    const name = typeof s['name'] === 'string' ? ` (${s['name']})` : '';
    return `Session #${s['number']}${name} started.`;
  }
  return JSON.stringify(s, null, 2);
}

// ── Agent response builder ────────────────────────────────────────────────────

function buildAgentResponse(res: DaemonResponse): AgentResponse {
  const display = formatHuman(res);

  switch (res.status) {
    case 'ok':
      return {
        status: 'ok',
        command: _currentCommand,
        display,
      };
    case 'error':
      return {
        status: 'error',
        command: _currentCommand,
        display,
        error: res.message,
      };
    case 'paused':
      return {
        status: 'paused',
        command: _currentCommand,
        display,
        action: res.prompt,
      };
  }
}
