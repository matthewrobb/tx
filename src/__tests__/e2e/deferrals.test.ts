// src/__tests__/e2e/deferrals.test.ts
//
// End-to-end deferral flow: defer a step, verify sibling + notes + traceability,
// then pull the deferred issue into a new cycle.

import { describe, test, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue, closeIssue, getIssueBySlug } from '../../issues/crud.js';
import { deferStep } from '../../issues/deferrals.js';
import { startCycle, pullIssues, closeCycle } from '../../cycles/lifecycle.js';
import type { Json } from '../../types/issue.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function featureInput(slug: string) {
  return {
    slug,
    title: `Feature ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
  };
}

/** Query all notes for a given issue slug. */
async function notesFor(
  db: PGLiteStorageAdapter,
  issueSlug: string,
): Promise<Array<{ summary: string; tag: string }>> {
  const result = await db.query<{ summary: string; tag: string }>(
    `SELECT summary, tag FROM notes WHERE issue_slug = $1 ORDER BY created_at ASC`,
    [issueSlug],
  );
  return result.rows;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('deferrals E2E', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  // 1. Deferring a step creates sibling issue with traceability
  test('deferring a step creates sibling issue with full traceability', async () => {
    const source = await createIssue(db, featureInput('main-feat'));
    expect(source.step).toBe('research');

    const result = await deferStep(db, {
      source_slug: 'main-feat',
      step: 'research',
      reason: 'blocked on external dependency',
    });

    // Deferred issue exists and has correct shape
    const deferred = result.deferred;
    expect(deferred.slug).toContain('main-feat');
    expect(deferred.slug).toContain('deferred');
    expect(deferred.slug).toContain('research');
    expect(deferred.status).toBe('open');
    expect(deferred.type).toBe('feature');
    expect(deferred.workflow_id).toBe('feature');

    // Deferred issue metadata has provenance
    const deferredFrom = deferred.metadata['deferred_from'] as Record<string, unknown>;
    expect(deferredFrom['issue_slug']).toBe('main-feat');
    expect(deferredFrom['step']).toBe('research');
    expect(deferredFrom['workflow_id']).toBe('feature');
    expect(typeof deferredFrom['deferred_at']).toBe('string');

    // Source issue metadata records the deferral
    const sourceUpdated = result.source;
    const deferrals = sourceUpdated.metadata['deferrals'] as Array<Record<string, Json>>;
    expect(deferrals).toHaveLength(1);
    expect(deferrals[0]!['step']).toBe('research');
    expect(deferrals[0]!['deferred_slug']).toBe(deferred.slug);

    // Source gets a 'defer' note
    const sourceNotes = await notesFor(db, 'main-feat');
    expect(sourceNotes).toHaveLength(1);
    expect(sourceNotes[0]!.tag).toBe('defer');
    expect(sourceNotes[0]!.summary).toContain('research');
    expect(sourceNotes[0]!.summary).toContain('blocked on external dependency');

    // Deferred issue gets a 'discover' note
    const deferredNotes = await notesFor(db, deferred.slug);
    expect(deferredNotes).toHaveLength(1);
    expect(deferredNotes[0]!.tag).toBe('discover');
    expect(deferredNotes[0]!.summary).toContain('main-feat');

    // Deferred issue is retrievable by slug
    const fromDb = await getIssueBySlug(db, deferred.slug);
    expect(fromDb).not.toBeNull();
    expect(fromDb!.title).toContain('[Deferred]');
  });

  // 2. Deferred issue can be pulled into next cycle
  test('deferred issue can be pulled into next cycle', async () => {
    // Create source issue and defer a step
    await createIssue(db, featureInput('cycle-feat'));
    const deferResult = await deferStep(db, {
      source_slug: 'cycle-feat',
      step: 'research',
      reason: 'not ready yet',
    });

    // Start first cycle, pull everything, close the source but not the deferred
    const c1 = await startCycle(db, { slug: 'sprint-1', title: 'Sprint 1' });
    const pullResult1 = await pullIssues(db, c1.slug, []);
    // Both the source and deferred issues should be pulled
    expect(pullResult1.pulled.length).toBeGreaterThanOrEqual(2);

    // Close the source issue
    await closeIssue(db, 'cycle-feat');

    // Close cycle 1
    const close1 = await closeCycle(db, {
      cycleSlug: c1.slug,
      summary: 'Sprint 1 done, deferred work remains.',
    });
    expect(close1.carried_over).toBeGreaterThanOrEqual(1);

    // Start cycle 2 — deferred issue is still open and pullable
    const c2 = await startCycle(db, { slug: 'sprint-2', title: 'Sprint 2' });
    const pullResult2 = await pullIssues(db, c2.slug, []);

    // The deferred issue should be pulled into the new cycle
    const deferredSlug = deferResult.deferred.slug;
    const pulledSlugs = pullResult2.pulled.map((i) => i.slug);
    expect(pulledSlugs).toContain(deferredSlug);

    // The source issue (done) should not be pulled
    expect(pulledSlugs).not.toContain('cycle-feat');
  });

  // 3. Multiple deferrals on the same issue accumulate
  test('multiple deferrals accumulate in source metadata', async () => {
    await createIssue(db, featureInput('multi-defer'));

    const r1 = await deferStep(db, {
      source_slug: 'multi-defer',
      step: 'research',
      reason: 'first deferral',
    });

    const r2 = await deferStep(db, {
      source_slug: 'multi-defer',
      step: 'scope',
      reason: 'second deferral',
    });

    // Both deferrals recorded in metadata
    const sourceFromDb = await getIssueBySlug(db, 'multi-defer');
    const deferrals = sourceFromDb!.metadata['deferrals'] as Array<Record<string, Json>>;
    expect(deferrals).toHaveLength(2);
    expect(deferrals[0]!['step']).toBe('research');
    expect(deferrals[1]!['step']).toBe('scope');

    // Source has two 'defer' notes
    const sourceNotes = await notesFor(db, 'multi-defer');
    expect(sourceNotes).toHaveLength(2);
    expect(sourceNotes.every((n) => n.tag === 'defer')).toBe(true);

    void r1;
    void r2;
  });
});
