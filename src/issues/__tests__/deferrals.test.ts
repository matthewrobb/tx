// src/issues/__tests__/deferrals.test.ts
//
// Behavioral tests for issue step deferrals.
// All tests use createInMemoryStorageAdapter() — no file I/O.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue } from '../crud.js';
import { deferStep } from '../deferrals.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function featureInput(slug: string) {
  return {
    slug,
    title: `Issue ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
  };
}

/** Query all notes for an issue slug. */
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

// ── Setup ─────────────────────────────────────────────────────────────────

let db: PGLiteStorageAdapter;

beforeEach(async () => {
  db = await createInMemoryStorageAdapter();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('deferStep', () => {
  // 1. Creates new deferred issue with correct metadata
  it('creates a new deferred issue with correct metadata', async () => {
    await createIssue(db, featureInput('source-1'));

    const result = await deferStep(db, {
      source_slug: 'source-1',
      step: 'research',
      reason: 'blocked on external API',
    });

    expect(result.deferred.slug).toContain('source-1');
    expect(result.deferred.slug).toContain('deferred');
    expect(result.deferred.slug).toContain('research');
    expect(result.deferred.title).toBe('[Deferred] Issue source-1 — research');
    expect(result.deferred.type).toBe('feature');
    expect(result.deferred.workflow_id).toBe('feature');
    expect(result.deferred.status).toBe('open');
  });

  // 2. Deferred issue has deferred_from in metadata
  it('deferred issue has deferred_from in metadata', async () => {
    const source = await createIssue(db, featureInput('source-2'));

    const result = await deferStep(db, {
      source_slug: 'source-2',
      step: 'scope',
      reason: 'needs product decision',
    });

    const meta = result.deferred.metadata;
    expect(meta['deferred_from']).toBeDefined();

    // Narrow: deferred_from is an object with expected keys
    const df = meta['deferred_from'] as Record<string, unknown>;
    expect(df['issue_slug']).toBe('source-2');
    expect(df['issue_id']).toBe(source.id);
    expect(df['step']).toBe('scope');
    expect(df['workflow_id']).toBe('feature');
    expect(typeof df['deferred_at']).toBe('string');

    expect(meta['reason']).toBe('needs product decision');
  });

  // 3. Source issue gets a 'defer' note
  it("source issue gets a 'defer' note", async () => {
    await createIssue(db, featureInput('source-3'));

    const result = await deferStep(db, {
      source_slug: 'source-3',
      step: 'plan',
      reason: 'timeline slipped',
    });

    const notes = await notesFor(db, 'source-3');
    expect(notes).toHaveLength(1);
    expect(notes[0]!.tag).toBe('defer');
    expect(notes[0]!.summary).toContain('plan');
    expect(notes[0]!.summary).toContain(result.deferred.slug);
    expect(notes[0]!.summary).toContain('timeline slipped');
  });

  // 4. Deferred issue gets a 'discover' note
  it("deferred issue gets a 'discover' note", async () => {
    await createIssue(db, featureInput('source-4'));

    const result = await deferStep(db, {
      source_slug: 'source-4',
      step: 'build',
      reason: 'out of scope for this sprint',
    });

    const notes = await notesFor(db, result.deferred.slug);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.tag).toBe('discover');
    expect(notes[0]!.summary).toContain('source-4');
    expect(notes[0]!.summary).toContain('build');
  });

  // 5. Source issue metadata updated with deferral record
  it('source issue metadata is updated with deferral record', async () => {
    await createIssue(db, featureInput('source-5'));

    const result = await deferStep(db, {
      source_slug: 'source-5',
      step: 'research',
      reason: 'need more data',
    });

    const deferrals = result.source.metadata['deferrals'];
    expect(Array.isArray(deferrals)).toBe(true);

    const list = deferrals as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]!['step']).toBe('research');
    expect(list[0]!['deferred_slug']).toBe(result.deferred.slug);
    expect(typeof list[0]!['at']).toBe('string');
  });

  // 6. With new_title override — uses provided title
  it('uses new_title when provided', async () => {
    await createIssue(db, featureInput('source-6'));

    const result = await deferStep(db, {
      source_slug: 'source-6',
      step: 'scope',
      reason: 'punting to Q3',
      new_title: 'Custom deferred title',
    });

    expect(result.deferred.title).toBe('Custom deferred title');
  });

  // 7. With new_type override — uses provided type
  it('uses new_type when provided', async () => {
    await createIssue(db, featureInput('source-7'));

    const result = await deferStep(db, {
      source_slug: 'source-7',
      step: 'research',
      reason: 'becoming its own investigation',
      new_type: 'spike',
    });

    expect(result.deferred.type).toBe('spike');
  });

  // 8. Unknown source slug — throws
  //
  // Design decision: deferStep throws on an unknown source slug rather than
  // returning an error result because the caller always knows the slug
  // before calling and a missing slug is a programming error (not a
  // recoverable runtime condition). Consistent with closeIssue and archiveIssue.
  it('throws when the source slug does not exist', async () => {
    await expect(
      deferStep(db, {
        source_slug: 'does-not-exist',
        step: 'research',
        reason: 'should not matter',
      }),
    ).rejects.toThrow('Issue not found: does-not-exist');
  });
});
