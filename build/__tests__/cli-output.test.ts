// build/__tests__/cli-output.test.ts
//
// Tests for src/cli/output.ts (v4 API).
// In v4, output.ts exports formatResponse() and printResponse() which operate
// on DaemonResponse (not AgentResponse). formatResponse() accepts agentMode:
//   - agentMode=false → human-readable text
//   - agentMode=true  → JSON-serialised AgentResponse

import { describe, it, expect } from 'vitest';
import { formatResponse } from '../../src/cli/output.js';
import type { DaemonResponse } from '../../src/types/protocol.js';

describe('formatResponse (human mode)', () => {
  it('returns display text for ok status', () => {
    const res: DaemonResponse = { status: 'ok', data: 'All good' };
    expect(formatResponse(res, false)).toContain('All good');
  });

  it('shows error message for error status', () => {
    const res: DaemonResponse = { status: 'error', message: 'No active issue' };
    expect(formatResponse(res, false)).toContain('No active issue');
  });

  it('shows pause prompt for paused status', () => {
    const res: DaemonResponse = {
      status: 'paused',
      prompt: { type: 'confirm', message: 'Settings change', next_command: 'tx next' },
    };
    expect(formatResponse(res, false)).toContain('Settings change');
  });
});

describe('formatResponse (agent mode)', () => {
  it('serialises DaemonResponse as AgentResponse JSON', () => {
    const res: DaemonResponse = { status: 'ok', data: 'All good' };
    const json = formatResponse(res, true);
    const parsed = JSON.parse(json) as { status: string; command: string };
    expect(parsed.status).toBe('ok');
    expect(typeof parsed.command).toBe('string');
  });

  it('includes error field for error status', () => {
    const res: DaemonResponse = { status: 'error', message: 'Something failed' };
    const json = formatResponse(res, true);
    const parsed = JSON.parse(json) as { status: string; error: string };
    expect(parsed.status).toBe('error');
    expect(parsed.error).toContain('Something failed');
  });
});
