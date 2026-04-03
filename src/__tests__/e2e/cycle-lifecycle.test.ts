// src/__tests__/e2e/cycle-lifecycle.test.ts
//
// End-to-end cycle lifecycle: start -> pull issues -> advance -> close with retro.
// Exercises startCycle, pullIssues, closeCycle, and verifies the retro checkpoint.

import { describe, test, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue, closeIssue } from '../../issues/crud.js';
import { startCycle, pullIssues, closeCycle } from '../../cycles/lifecycle.js';
import { getLatestCheckpoint } from '../../checkpoints/crud.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function featureInput(slug: string) {
  return {
    slug,
    title: `Feature ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('cycle lifecycle E2E', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  // 1. Full cycle flow: start -> pull -> close one issue -> close cycle
  test('cycle start -> pull -> close generates retro and checkpoint', async () => {
    // Create some issues
    await createIssue(db, featureInput('feat-a'));
    await createIssue(db, featureInput('feat-b'));

    // Start cycle
    const cycle = await startCycle(db, { slug: 'sprint-1', title: 'Sprint 1' });
    expect(cycle.status).toBe('active');
    expect(cycle.closed_at).toBeNull();

    // Cannot start another cycle while one is active
    await expect(
      startCycle(db, { slug: 'sprint-2', title: 'Sprint 2' }),
    ).rejects.toThrow(/already active/i);

    // Pull issues (auto-pull all open)
    const pulled = await pullIssues(db, 'sprint-1', []);
    expect(pulled.pulled).toHaveLength(2);
    expect(pulled.skipped).toHaveLength(0);

    // Close feat-a
    await closeIssue(db, 'feat-a');

    // Close cycle
    const result = await closeCycle(db, {
      cycleSlug: 'sprint-1',
      summary: 'Good sprint',
    });

    expect(result.completed).toBe(1);
    expect(result.carried_over).toBe(1);
    expect(result.retro).toContain('feat-a');
    expect(result.retro).toContain('feat-b');
    expect(result.retro).toContain('Good sprint');
    expect(result.checkpointId).toBeTruthy();
    expect(result.cycle.status).toBe('closed');
    expect(result.cycle.closed_at).not.toBeNull();
  });

  // 2. After closing cycle, a new cycle can be started
  test('new cycle can start after previous cycle closes', async () => {
    await createIssue(db, featureInput('feat-x'));
    const c1 = await startCycle(db, { slug: 'sprint-1', title: 'Sprint 1' });
    await pullIssues(db, c1.slug, []);
    await closeCycle(db, { cycleSlug: c1.slug, summary: 'Done.' });

    // Now a new cycle can start
    const c2 = await startCycle(db, { slug: 'sprint-2', title: 'Sprint 2' });
    expect(c2.status).toBe('active');
  });

  // 3. closeCycle creates a checkpoint retrievable via getLatestCheckpoint
  test('closeCycle checkpoint is retrievable via getLatestCheckpoint', async () => {
    await createIssue(db, featureInput('feat-cp'));
    const cycle = await startCycle(db, { slug: 'sprint-cp', title: 'CP Sprint' });
    await pullIssues(db, cycle.slug, []);

    const closeResult = await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Checkpoint test',
    });

    const latest = await getLatestCheckpoint(db);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(closeResult.checkpointId);
    expect(latest!.content).toBe(closeResult.retro);
    expect(latest!.summary).toContain('Retro');
  });

  // 4. Pull with explicit slugs only pulls specified issues
  test('pull with explicit slugs only pulls specified issues', async () => {
    await createIssue(db, featureInput('pick-a'));
    await createIssue(db, featureInput('pick-b'));
    await createIssue(db, featureInput('pick-c'));

    const cycle = await startCycle(db, { slug: 'pick-sprint', title: 'Pick Sprint' });

    const result = await pullIssues(db, cycle.slug, ['pick-a', 'pick-c']);
    expect(result.pulled).toHaveLength(2);
    const slugs = result.pulled.map((i) => i.slug).sort();
    expect(slugs).toEqual(['pick-a', 'pick-c']);
  });

  // 5. Pull skips done issues
  test('pull skips done issues', async () => {
    await createIssue(db, featureInput('done-issue'));
    await closeIssue(db, 'done-issue');
    await createIssue(db, featureInput('open-issue'));

    const cycle = await startCycle(db, { slug: 'skip-sprint', title: 'Skip Sprint' });
    const result = await pullIssues(db, cycle.slug, []);

    expect(result.pulled).toHaveLength(1);
    expect(result.pulled[0]!.slug).toBe('open-issue');
    // done-issue was not a candidate because auto-pull filters to status: open
  });

  // 6. closeCycle with all issues done => 0 carried over
  test('closeCycle with all issues completed', async () => {
    await createIssue(db, featureInput('done-a'));
    await createIssue(db, featureInput('done-b'));

    const cycle = await startCycle(db, { slug: 'all-done', title: 'All Done' });
    await pullIssues(db, cycle.slug, []);

    await closeIssue(db, 'done-a');
    await closeIssue(db, 'done-b');

    const result = await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Everything done!',
    });

    expect(result.completed).toBe(2);
    expect(result.carried_over).toBe(0);
  });
});
