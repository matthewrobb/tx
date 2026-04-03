// src/issues/__tests__/workflow.test.ts
//
// Behavioral tests for workflow assignment and independent advancement.
// Tests 1–5 are pure (no DB). Tests 6–7 use createInMemoryStorageAdapter.

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { resolveWorkflowId, reassignWorkflow, advanceIssue } from '../workflow.js';

// ── 1–5. resolveWorkflowId — pure config lookup ─────────────────────────

describe('resolveWorkflowId', () => {
  it('resolves feature type to feature workflow', () => {
    expect(resolveWorkflowId('feature', DEFAULT_CONFIG)).toBe('feature');
  });

  it('resolves bug type to bug workflow', () => {
    expect(resolveWorkflowId('bug', DEFAULT_CONFIG)).toBe('bug');
  });

  it('resolves chore type to chore workflow', () => {
    expect(resolveWorkflowId('chore', DEFAULT_CONFIG)).toBe('chore');
  });

  it('resolves spike type to spike workflow', () => {
    expect(resolveWorkflowId('spike', DEFAULT_CONFIG)).toBe('spike');
  });

  it('falls back to feature for release (no default_for match)', () => {
    // DEFAULT_CONFIG has no workflow with default_for: ['release'].
    expect(resolveWorkflowId('release', DEFAULT_CONFIG)).toBe('feature');
  });
});

// ── 6. reassignWorkflow — changes workflow_id and resets step ────────────

describe('reassignWorkflow', () => {
  // Use real PGLite in-memory adapter for DB tests.
  let db: Awaited<ReturnType<typeof import('../../adapters/pglite/index.js').createInMemoryStorageAdapter>>;

  beforeEach(async () => {
    const { createInMemoryStorageAdapter } = await import('../../adapters/pglite/index.js');
    db = await createInMemoryStorageAdapter();
  });

  it('changes workflow_id and resets step to first step of new workflow', async () => {
    // Import createIssue and getIssueBySlug here to avoid circular mock issues.
    const { createIssue, getIssueBySlug } = await import('../crud.js');

    // Create a feature issue (starts at 'research').
    const issue = await createIssue(db, {
      slug: 'reassign-me',
      title: 'Reassign test',
      type: 'feature',
      workflow_id: 'feature',
    });
    expect(issue.step).toBe('research');
    expect(issue.workflow_id).toBe('feature');

    // Reassign to the 'bug' workflow.
    await reassignWorkflow(db, 'reassign-me', 'bug', DEFAULT_CONFIG);

    // Verify the issue now has the bug workflow and is on its first step.
    const updated = await getIssueBySlug(db, 'reassign-me');
    expect(updated).not.toBeNull();
    expect(updated!.workflow_id).toBe('bug');
    // Bug workflow: first step with empty needs is 'reproduce'.
    expect(updated!.step).toBe('reproduce');
  });

  it('throws when workflow is not found in config', async () => {
    const { createIssue } = await import('../crud.js');
    await createIssue(db, {
      slug: 'bad-wf',
      title: 'Bad workflow test',
      type: 'feature',
      workflow_id: 'feature',
    });

    await expect(
      reassignWorkflow(db, 'bad-wf', 'nonexistent', DEFAULT_CONFIG),
    ).rejects.toThrow('Workflow not found in config: nonexistent');
  });

  it('throws when issue slug does not exist', async () => {
    await expect(
      reassignWorkflow(db, 'no-such-issue', 'bug', DEFAULT_CONFIG),
    ).rejects.toThrow('Issue not found: no-such-issue');
  });
});

// ── 7. advanceIssue — delegates to txNext ────────────────────────────────

describe('advanceIssue', () => {
  // Mock txNext to verify advanceIssue delegates correctly.
  // vi.mock hoists above imports, so txNext from state.js is replaced.
  vi.mock('../../engine/state.js', () => ({
    txNext: vi.fn(async (_db: unknown, _proj: unknown, input: { issue_slug: string; resume_response?: string }) => ({
      status: 'advanced' as const,
      issue: {
        issue: input.issue_slug,
        type: 'feature',
        workflow_id: 'feature',
        step: 'scope',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
      },
      from_step: 'research',
      to_step: 'scope',
    })),
  }));

  it('delegates to txNext and returns its result', async () => {
    const { txNext: mockedTxNext } = await import('../../engine/state.js');

    // Minimal stubs — advanceIssue just passes them through to txNext.
    const fakeDb = {} as Parameters<typeof advanceIssue>[0];
    const fakeProjection = {} as Parameters<typeof advanceIssue>[1];

    const result = await advanceIssue(fakeDb, fakeProjection, 'my-issue');

    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.from_step).toBe('research');
      expect(result.to_step).toBe('scope');
    }

    // Verify txNext was called with the correct arguments.
    expect(mockedTxNext).toHaveBeenCalledWith(fakeDb, fakeProjection, {
      issue_slug: 'my-issue',
      resume_response: undefined,
    });
  });

  it('passes resume_response through to txNext', async () => {
    const { txNext: mockedTxNext } = await import('../../engine/state.js');

    const fakeDb = {} as Parameters<typeof advanceIssue>[0];
    const fakeProjection = {} as Parameters<typeof advanceIssue>[1];

    await advanceIssue(fakeDb, fakeProjection, 'my-issue', 'yes');

    expect(mockedTxNext).toHaveBeenCalledWith(fakeDb, fakeProjection, {
      issue_slug: 'my-issue',
      resume_response: 'yes',
    });
  });
});
