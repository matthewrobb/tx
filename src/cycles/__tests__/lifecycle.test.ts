// src/cycles/__tests__/lifecycle.test.ts
//
// Behavioral tests for cycle lifecycle: startCycle, pullIssues, closeCycle.
// All tests use createInMemoryStorageAdapter() — no file I/O.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue, updateIssue } from '../../issues/crud.js';
import { startCycle, pullIssues, closeCycle } from '../lifecycle.js';
import type { IssueId } from '../../types/issue.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function featureInput(slug: string) {
  return {
    slug,
    title: `Issue ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
  };
}

function cycleInput(slug = 'sprint-1') {
  return {
    slug,
    title: 'Sprint 1',
    description: 'First sprint',
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────

let db: PGLiteStorageAdapter;

beforeEach(async () => {
  db = await createInMemoryStorageAdapter();
});

// ── 1. startCycle — creates cycle with status 'active' ────────────────────

describe('startCycle', () => {
  it('creates cycle with status active', async () => {
    const cycle = await startCycle(db, cycleInput());

    expect(cycle.slug).toBe('sprint-1');
    expect(cycle.title).toBe('Sprint 1');
    expect(cycle.status).toBe('active');
    expect(cycle.closed_at).toBeNull();
    expect(cycle.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(cycle.id).toBeTruthy();
  });

  // ── 2. startCycle — errors if a cycle is already active ─────────────────

  it('errors if a cycle is already active', async () => {
    await startCycle(db, cycleInput('sprint-1'));

    await expect(startCycle(db, cycleInput('sprint-2'))).rejects.toThrow(
      /already active/i,
    );
  });
});

// ── 3. pullIssues — with explicit slugs pulls those issues ────────────────

describe('pullIssues — explicit slugs', () => {
  it('pulls specified issues into the cycle', async () => {
    await createIssue(db, featureInput('feat-a'));
    await createIssue(db, featureInput('feat-b'));
    await createIssue(db, featureInput('feat-c'));
    const cycle = await startCycle(db, cycleInput());

    const result = await pullIssues(db, cycle.slug, ['feat-a', 'feat-c']);

    expect(result.pulled).toHaveLength(2);
    const pulledSlugs = result.pulled.map((i) => i.slug).sort();
    expect(pulledSlugs).toEqual(['feat-a', 'feat-c']);
    expect(result.skipped).toHaveLength(0);
  });
});

// ── 4. pullIssues — empty slugs auto-pulls all open issues ────────────────

describe('pullIssues — auto-pull', () => {
  it('auto-pulls all open issues when issueSlugs is empty', async () => {
    await createIssue(db, featureInput('auto-a'));
    await createIssue(db, featureInput('auto-b'));
    const cycle = await startCycle(db, cycleInput());

    const result = await pullIssues(db, cycle.slug, []);

    expect(result.pulled).toHaveLength(2);
    const pulledSlugs = result.pulled.map((i) => i.slug).sort();
    expect(pulledSlugs).toEqual(['auto-a', 'auto-b']);
    expect(result.skipped).toHaveLength(0);
  });
});

// ── 5. pullIssues — already-in-cycle issues go to skipped ─────────────────

describe('pullIssues — skipping', () => {
  it('skips issues already in the cycle', async () => {
    const issueA = await createIssue(db, featureInput('skip-a'));
    await createIssue(db, featureInput('skip-b'));
    const cycle = await startCycle(db, cycleInput());

    // Pull skip-a first
    await pullIssues(db, cycle.slug, ['skip-a']);

    // Pull both — skip-a is already in the cycle
    const result = await pullIssues(db, cycle.slug, ['skip-a', 'skip-b']);

    expect(result.pulled).toHaveLength(1);
    expect(result.pulled[0]!.slug).toBe('skip-b');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.slug).toBe('skip-a');

    void issueA; // suppress unused-variable lint
  });

  it('skips done issues', async () => {
    const issue = await createIssue(db, featureInput('done-issue'));
    await updateIssue(db, issue.id as IssueId, { status: 'done' });
    const cycle = await startCycle(db, cycleInput());

    // Explicit pull of a done issue
    const result = await pullIssues(db, cycle.slug, ['done-issue']);

    expect(result.pulled).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.slug).toBe('done-issue');
  });
});

// ── 6. closeCycle — sets status to 'closed', closed_at set ───────────────

describe('closeCycle', () => {
  it('sets status to closed and populates closed_at', async () => {
    const cycle = await startCycle(db, cycleInput());
    await pullIssues(db, cycle.slug, []);

    const result = await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Clean close.',
    });

    expect(result.cycle.status).toBe('closed');
    expect(result.cycle.closed_at).not.toBeNull();
    expect(result.cycle.closed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ── 7. closeCycle — completed_at set on done issues in cycle_issues ───────

  it('sets completed_at on done issues in cycle_issues', async () => {
    const issueA = await createIssue(db, featureInput('close-a'));
    await createIssue(db, featureInput('close-b'));
    const cycle = await startCycle(db, cycleInput());
    await pullIssues(db, cycle.slug, []);

    // Mark close-a as done
    await updateIssue(db, issueA.id as IssueId, { status: 'done' });

    await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Done.',
    });

    // Verify completed_at in the DB for the done issue.
    const ciRows = await db.query<{
      issue_id: string;
      completed_at: string | null;
    }>(
      `SELECT ci.issue_id, ci.completed_at
       FROM cycle_issues ci
       JOIN issues i ON i.id = ci.issue_id
       WHERE ci.cycle_id = $1`,
      [cycle.id],
    );

    const doneRow = ciRows.rows.find((r) => r.issue_id === issueA.id);
    const openRow = ciRows.rows.find((r) => r.issue_id !== issueA.id);

    expect(doneRow).toBeDefined();
    expect(doneRow!.completed_at).not.toBeNull();
    expect(openRow!.completed_at).toBeNull();
  });

  // ── 8. closeCycle — returns correct completed/carried_over counts ─────────

  it('returns correct completed and carried_over counts', async () => {
    const a = await createIssue(db, featureInput('count-a'));
    const b = await createIssue(db, featureInput('count-b'));
    await createIssue(db, featureInput('count-c'));
    const cycle = await startCycle(db, cycleInput());
    await pullIssues(db, cycle.slug, []);

    // Mark two as done
    await updateIssue(db, a.id as IssueId, { status: 'done' });
    await updateIssue(db, b.id as IssueId, { status: 'done' });

    const result = await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Two done, one carried over.',
    });

    expect(result.completed).toBe(2);
    expect(result.carried_over).toBe(1);
  });

  // ── 9. closeCycle — creates a checkpoint ─────────────────────────────────

  it('creates a checkpoint', async () => {
    const cycle = await startCycle(db, cycleInput());
    await pullIssues(db, cycle.slug, []);

    const result = await closeCycle(db, {
      cycleSlug: cycle.slug,
      summary: 'Sprint done.',
    });

    expect(result.checkpointId).toBeTruthy();
    expect(result.retro).toContain('# Retro:');
    expect(result.retro).toContain('Sprint done.');

    // Verify the checkpoint actually exists in the DB.
    const cpRows = await db.query<{ id: string; content: string }>(
      'SELECT id, content FROM checkpoints WHERE id = $1',
      [result.checkpointId],
    );
    expect(cpRows.rows).toHaveLength(1);
    expect(cpRows.rows[0]!.content).toBe(result.retro);
  });
});
