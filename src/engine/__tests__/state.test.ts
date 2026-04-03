// src/engine/__tests__/state.test.ts — Tests for atomic txNext.
//
// Uses createInMemoryStorageAdapter (PGLite WASM in-memory) and a mock
// ProjectionPort. Each test gets a fresh DB so there's no cross-test leakage.
//
// To test all txNext code paths (advance, skip, done, blocked, paused),
// we mock DEFAULT_CONFIG with custom workflows that have expression conditions.

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock DEFAULT_CONFIG before importing txNext so the mock is in place.
// These test workflows use expression conditions to exercise every path.
vi.mock('../../config/defaults.js', () => ({
  DEFAULT_CONFIG: {
    version: '4.0',
    workflows: [
      {
        // Linear 2-step with done_when: "true" on step 1 so it auto-completes.
        id: 'test-advance',
        title: 'Test Advance',
        default_for: [],
        steps: [
          { id: 'step-a', title: 'Step A', needs: [], done_when: 'true' },
          { id: 'step-b', title: 'Step B', needs: ['step-a'] },
        ],
      },
      {
        // Skip workflow: step 1 has skip_when: "true".
        id: 'test-skip',
        title: 'Test Skip',
        default_for: [],
        steps: [
          { id: 'skippable', title: 'Skippable', needs: [], skip_when: 'true' },
          { id: 'after-skip', title: 'After Skip', needs: ['skippable'] },
        ],
      },
      {
        // All-done workflow: single step with done_when: "true".
        id: 'test-done',
        title: 'Test Done',
        default_for: [],
        steps: [
          { id: 'only', title: 'Only', needs: [], done_when: 'true' },
        ],
      },
      {
        // Blocked workflow: step has block_when: "true".
        id: 'test-blocked',
        title: 'Test Blocked',
        default_for: [],
        steps: [
          { id: 'gated', title: 'Gated', needs: [], block_when: 'true' },
        ],
      },
      {
        // Paused workflow: step has done_when with confirm().
        id: 'test-paused',
        title: 'Test Paused',
        default_for: [],
        steps: [
          { id: 'interactive', title: 'Interactive', needs: [], done_when: "confirm('deploy?')" },
        ],
      },
      {
        // Resume workflow: done_when checks vars.resume_response.
        // Before resume_response is set, the expression evaluates falsy (no_change).
        // After resume_response is set via txNext resume, it evaluates truthy.
        id: 'test-resume',
        title: 'Test Resume',
        default_for: [],
        steps: [
          { id: 'awaiting', title: 'Awaiting', needs: [], done_when: "vars.resume_response == 'yes'" },
        ],
      },
      {
        // No-conditions workflow: step with no done_when/skip_when/block_when.
        id: 'test-nochange',
        title: 'Test No Change',
        default_for: [],
        steps: [
          { id: 'idle', title: 'Idle', needs: [] },
          { id: 'next', title: 'Next', needs: ['idle'] },
        ],
      },
      {
        // Cycle-gated workflow: done_when checks active cycle.
        id: 'test-cycle',
        title: 'Test Cycle',
        default_for: [],
        steps: [
          { id: 'wait-for-cycle', title: 'Wait', needs: [], done_when: "cycle.status == 'active'" },
          { id: 'after-cycle', title: 'After', needs: ['wait-for-cycle'] },
        ],
      },
      {
        // Artifact-gated workflow: done_when checks artifacts.all_present.
        id: 'test-artifacts',
        title: 'Test Artifacts',
        default_for: [],
        steps: [
          {
            id: 'write-scope',
            title: 'Write Scope',
            needs: [],
            produces: [{ path: 'scope' }],
            done_when: 'artifacts.all_present',
          },
          { id: 'after-scope', title: 'After Scope', needs: ['write-scope'] },
        ],
      },
    ],
    context_skills: [],
    step_skills: {},
    step_review_skills: {},
  },
}));

import { createInMemoryStorageAdapter } from '../../adapters/pglite/adapter.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import type { ProjectionPort } from '../../ports/projection.js';
import type { StoragePort } from '../../ports/storage.js';
import { txNext } from '../state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock ProjectionPort that records calls. */
function mockProjection(): ProjectionPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    renderIssue: vi.fn(async (slug: string) => { calls.push(`renderIssue:${slug}`); }),
    renderCycle: vi.fn(async (slug: string) => { calls.push(`renderCycle:${slug}`); }),
    renderCheckpoint: vi.fn(async (id: string) => { calls.push(`renderCheckpoint:${id}`); }),
    renderSnapshot: vi.fn(async () => { calls.push('renderSnapshot'); }),
    deleteIssue: vi.fn(async (slug: string) => { calls.push(`deleteIssue:${slug}`); }),
  };
}

/**
 * Create an issue directly in the DB, bypassing createIssue() which validates
 * against the (mocked) DEFAULT_CONFIG for the initial step. We need to control
 * the exact step the issue starts on.
 */
async function seedIssue(
  db: StoragePort,
  slug: string,
  workflowId: string,
  step: string,
  type: string = 'feature',
  status: string = 'open',
): Promise<void> {
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO issues
       (id, slug, title, body, type, workflow_id, step, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, '{}'::jsonb, $8, $9)`,
    [
      `id-${slug}`,
      slug,
      `Title for ${slug}`,
      type,
      workflowId,
      step,
      status,
      now,
      now,
    ],
  );
}

/**
 * Insert a task into the DB for a given issue.
 */
async function insertTask(
  db: StoragePort,
  issueSlug: string,
  id: string,
  summary: string,
  done: boolean,
): Promise<void> {
  await db.query(
    `INSERT INTO tasks (id, issue_slug, summary, done, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, issueSlug, summary, done ? 1 : 0, new Date().toISOString()],
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('txNext', () => {
  let db: PGLiteStorageAdapter;
  let projection: ProjectionPort & { calls: string[] };

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
    projection = mockProjection();
  });

  // 1. Advance: issue on step-a with done_when: "true" → advances to step-b.
  test('1. advance — current step done_when true, advances to next ready step', async () => {
    await seedIssue(db, 'adv-1', 'test-advance', 'step-a');

    const result = await txNext(db, projection, { issue_slug: 'adv-1' });

    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.from_step).toBe('step-a');
      expect(result.to_step).toBe('step-b');
      expect(result.issue.step).toBe('step-b');
      expect(result.issue.status).toBe('open');
    }
  });

  // 2. Skip: step with skip_when: "true" → skips to next step.
  test('2. skip — step with skip_when true, advances past it to next step', async () => {
    await seedIssue(db, 'skip-1', 'test-skip', 'skippable');

    const result = await txNext(db, projection, { issue_slug: 'skip-1' });

    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.from_step).toBe('skippable');
      expect(result.to_step).toBe('after-skip');
    }
  });

  // 3. Done: single step with done_when: "true" → issue status becomes 'done'.
  test('3. done — all steps done, issue status becomes done', async () => {
    await seedIssue(db, 'done-1', 'test-done', 'only');

    const result = await txNext(db, projection, { issue_slug: 'done-1' });

    expect(result.status).toBe('done');
    if (result.status === 'done') {
      expect(result.issue.status).toBe('done');
    }

    // Verify DB was actually updated.
    const row = await db.query<{ status: string }>(
      `SELECT status FROM issues WHERE slug = $1`,
      ['done-1'],
    );
    expect(row.rows[0]?.status).toBe('done');
  });

  // 4. Blocked: step with block_when: "true" → status becomes 'blocked'.
  test('4. blocked — block_when true on current step, issue becomes blocked', async () => {
    await seedIssue(db, 'block-1', 'test-blocked', 'gated');

    const result = await txNext(db, projection, { issue_slug: 'block-1' });

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.step).toBe('gated');
      expect(result.issue.status).toBe('blocked');
    }

    // Verify DB was updated.
    const row = await db.query<{ status: string }>(
      `SELECT status FROM issues WHERE slug = $1`,
      ['block-1'],
    );
    expect(row.rows[0]?.status).toBe('blocked');
  });

  // 5. Paused: done_when contains confirm() → returns paused with action.
  test('5. paused — confirm() in done_when returns paused with action', async () => {
    await seedIssue(db, 'pause-1', 'test-paused', 'interactive');

    const result = await txNext(db, projection, { issue_slug: 'pause-1' });

    expect(result.status).toBe('paused');
    if (result.status === 'paused') {
      expect(result.action).toBeDefined();
      expect(result.action.type).toBe('confirm');
      if (result.action.type === 'confirm') {
        expect(result.action.message).toBe('deploy?');
      }
    }
  });

  // 6. Resume: call txNext with resume_response after paused → var stored, re-evaluates.
  test('6. resume — resume_response stored in vars and used by expression', async () => {
    await seedIssue(db, 'resume-1', 'test-resume', 'awaiting');

    // First call: no resume_response, vars.resume_response is not set → no_change.
    const result1 = await txNext(db, projection, { issue_slug: 'resume-1' });
    expect(result1.status).toBe('no_change');

    // Second call: with resume_response = "yes" → var is stored, expression
    // vars.resume_response == "yes" evaluates true → done.
    const result2 = await txNext(db, projection, {
      issue_slug: 'resume-1',
      resume_response: 'yes',
    });

    expect(result2.status).toBe('done');
    if (result2.status === 'done') {
      expect(result2.issue.status).toBe('done');
    }

    // Verify the var was stored.
    const vars = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM vars WHERE issue_slug = $1`,
      ['resume-1'],
    );
    const resumeVar = vars.rows.find((r) => r.key === 'resume_response');
    expect(resumeVar).toBeDefined();
    expect(resumeVar?.value).toBe('yes');
  });

  // 7. No change: step with no conditions met → no_change.
  test('7. no_change — active step with no conditions met', async () => {
    await seedIssue(db, 'noop-1', 'test-nochange', 'idle');

    const result = await txNext(db, projection, { issue_slug: 'noop-1' });

    expect(result.status).toBe('no_change');
    if (result.status === 'no_change') {
      expect(result.issue.step).toBe('idle');
      expect(result.issue.status).toBe('open');
    }
  });

  // 8. Not found: unknown slug → error result.
  test('8. not found — unknown slug returns error result', async () => {
    const result = await txNext(db, projection, { issue_slug: 'no-such-issue' });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('no-such-issue');
    }
  });

  // 9. Projection called: after advance, projection.renderIssue() is called.
  test('9. projection called after advance', async () => {
    await seedIssue(db, 'proj-1', 'test-advance', 'step-a');

    await txNext(db, projection, { issue_slug: 'proj-1' });

    expect(projection.calls).toContain('renderIssue:proj-1');
  });

  // 10. Cycle context: no active cycle → no_change (cycle is null).
  test('10. cycle context — no active cycle, cycle expression evaluates null → no_change', async () => {
    await seedIssue(db, 'cyc-1', 'test-cycle', 'wait-for-cycle');

    const result = await txNext(db, projection, { issue_slug: 'cyc-1' });

    // cycle.status == 'active' → null == 'active' → false → no_change
    expect(result.status).toBe('no_change');
  });

  // 11. Cycle context: active cycle → advances (cycle.status == 'active' is true).
  test('11. cycle context — active cycle populates context, expression evaluates true → advance', async () => {
    await seedIssue(db, 'cyc-2', 'test-cycle', 'wait-for-cycle');

    // Start a cycle so the context includes it.
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO cycles (id, slug, title, status, started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      ['cycle-id-1', 'sprint-1', 'Sprint 1', 'active', now],
    );

    const result = await txNext(db, projection, { issue_slug: 'cyc-2' });

    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.from_step).toBe('wait-for-cycle');
      expect(result.to_step).toBe('after-cycle');
    }
  });

  // 12. Artifact context: no artifacts written → no_change (all_present is false).
  test('12. artifact context — no artifacts written, all_present false → no_change', async () => {
    await seedIssue(db, 'art-1', 'test-artifacts', 'write-scope');

    const result = await txNext(db, projection, { issue_slug: 'art-1' });

    expect(result.status).toBe('no_change');
  });

  // 13. Artifact context: artifact written → advances (all_present is true).
  test('13. artifact context — artifact written, all_present true → advance', async () => {
    await seedIssue(db, 'art-2', 'test-artifacts', 'write-scope');

    // Write the 'scope' artifact into vars for this issue+step.
    await db.query(
      `INSERT INTO vars (issue_slug, step, key, value)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['art-2', 'write-scope', 'scope', JSON.stringify('scope content')],
    );

    const result = await txNext(db, projection, { issue_slug: 'art-2' });

    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.from_step).toBe('write-scope');
      expect(result.to_step).toBe('after-scope');
    }
  });

  // 14. Transaction atomicity: projection failure does not roll back DB state.
  test('14. transaction atomicity — projection failure preserves DB state', async () => {
    await seedIssue(db, 'atomic-1', 'test-advance', 'step-a');

    const failProjection: ProjectionPort = {
      renderIssue: async () => { throw new Error('projection boom'); },
      renderCycle: async () => {},
      renderCheckpoint: async () => {},
      renderSnapshot: async () => {},
      deleteIssue: async () => {},
    };

    const result = await txNext(db, failProjection, { issue_slug: 'atomic-1' });

    // The advance should have succeeded despite projection failure.
    expect(result.status).toBe('advanced');
    if (result.status === 'advanced') {
      expect(result.to_step).toBe('step-b');
    }

    // Verify DB was actually updated — the advance committed.
    const row = await db.query<{ step: string; status: string }>(
      `SELECT step, status FROM issues WHERE slug = $1`,
      ['atomic-1'],
    );
    expect(row.rows[0]?.step).toBe('step-b');
    expect(row.rows[0]?.status).toBe('open');
  });
});
