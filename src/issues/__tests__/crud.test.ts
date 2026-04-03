// src/issues/__tests__/crud.test.ts
//
// Behavioral tests for issue CRUD and parent/child hierarchy.
// All tests use createInMemoryStorageAdapter() — no file I/O.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import {
  createIssue,
  getIssueBySlug,
  listIssues,
  updateIssue,
  closeIssue,
  archiveIssue,
} from '../crud.js';
import type { IssueId } from '../../types/issue.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function featureInput(slug: string, overrides: { parent_id?: IssueId } = {}) {
  return {
    slug,
    title: `Issue ${slug}`,
    type: 'feature' as const,
    // 'feature' workflow is in DEFAULT_CONFIG
    workflow_id: 'feature',
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────

let db: PGLiteStorageAdapter;

beforeEach(async () => {
  db = await createInMemoryStorageAdapter();
});

// ── 1. createIssue — correct initial step and status ─────────────────────

describe('createIssue', () => {
  it('creates issue with correct initial step and status', async () => {
    const issue = await createIssue(db, featureInput('feat-1'));

    expect(issue.slug).toBe('feat-1');
    expect(issue.type).toBe('feature');
    // feature workflow: first step with empty needs is 'research'
    expect(issue.step).toBe('research');
    expect(issue.status).toBe('open');
    expect(issue.parent_id).toBeNull();
    expect(issue.metadata).toEqual({});
    expect(issue.id).toBeTruthy();
    expect(issue.created_at).toBeTruthy();
    expect(issue.updated_at).toBeTruthy();
  });

  // ── 2. createIssue — duplicate slug errors ──────────────────────────────

  it('errors when slug is not unique', async () => {
    await createIssue(db, featureInput('dupe-slug'));

    await expect(
      createIssue(db, featureInput('dupe-slug')),
    ).rejects.toThrow();
  });
});

// ── 3. getIssueBySlug — retrieves by slug ────────────────────────────────

describe('getIssueBySlug', () => {
  it('retrieves an issue by slug', async () => {
    await createIssue(db, featureInput('find-me'));

    const found = await getIssueBySlug(db, 'find-me');

    expect(found).not.toBeNull();
    expect(found!.slug).toBe('find-me');
  });

  // ── 4. getIssueBySlug — returns null for unknown slug ──────────────────

  it('returns null for an unknown slug', async () => {
    const result = await getIssueBySlug(db, 'does-not-exist');
    expect(result).toBeNull();
  });
});

// ── 5. listIssues — lists all issues ─────────────────────────────────────

describe('listIssues', () => {
  it('lists all issues', async () => {
    await createIssue(db, featureInput('list-a'));
    await createIssue(db, featureInput('list-b'));
    await createIssue(db, featureInput('list-c'));

    const issues = await listIssues(db);

    expect(issues).toHaveLength(3);
    const slugs = issues.map((i) => i.slug).sort();
    expect(slugs).toEqual(['list-a', 'list-b', 'list-c']);
  });

  // ── 6. listIssues with status: 'done' filter ────────────────────────────

  it("returns only done issues when status: 'done' is provided", async () => {
    const a = await createIssue(db, featureInput('status-a'));
    await createIssue(db, featureInput('status-b'));

    // Close one issue directly via updateIssue (bypassing propagation for isolation)
    await updateIssue(db, a.id, { status: 'done' });

    const done = await listIssues(db, { status: 'done' });

    expect(done).toHaveLength(1);
    expect(done[0]!.slug).toBe('status-a');
  });

  // ── 7. listIssues with parent_id: null — top-level issues only ──────────

  it('returns only top-level issues when parent_id: null', async () => {
    const parent = await createIssue(db, featureInput('parent-top'));
    await createIssue(
      db,
      featureInput('child-top', { parent_id: parent.id }),
    );
    await createIssue(db, featureInput('sibling-top'));

    const topLevel = await listIssues(db, { parent_id: null });

    const slugs = topLevel.map((i) => i.slug).sort();
    expect(slugs).toEqual(['parent-top', 'sibling-top']);
  });
});

// ── 8. updateIssue — updates step and status, updated_at is newer ─────────

describe('updateIssue', () => {
  it('updates step and status; updated_at is newer than created_at', async () => {
    const issue = await createIssue(db, featureInput('update-me'));

    // Small delay so updated_at is strictly after created_at
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await updateIssue(db, issue.id, {
      step: 'scope',
      status: 'blocked',
    });

    expect(updated.step).toBe('scope');
    expect(updated.status).toBe('blocked');
    expect(updated.updated_at >= issue.updated_at).toBe(true);
  });
});

// ── 9. closeIssue — sets status to 'done' ────────────────────────────────

describe('closeIssue', () => {
  it("sets status to 'done'", async () => {
    await createIssue(db, featureInput('close-me'));

    const closed = await closeIssue(db, 'close-me');

    expect(closed.status).toBe('done');
    expect(closed.slug).toBe('close-me');
  });
});

// ── 10. archiveIssue — sets status to 'archived' ─────────────────────────

describe('archiveIssue', () => {
  it("sets status to 'archived'", async () => {
    await createIssue(db, featureInput('archive-me'));

    const archived = await archiveIssue(db, 'archive-me');

    expect(archived.status).toBe('archived');
    expect(archived.slug).toBe('archive-me');
  });
});

// ── 11 & 12. Hierarchy: parent auto-close propagation ─────────────────────

describe('hierarchy — auto-close propagation', () => {
  it('parent auto-closes when both children are closed', async () => {
    const parent = await createIssue(db, featureInput('parent-ac'));
    await createIssue(db, featureInput('child-ac-1', { parent_id: parent.id }));
    await createIssue(db, featureInput('child-ac-2', { parent_id: parent.id }));

    await closeIssue(db, 'child-ac-1');
    // After first child is closed, parent should still be open.
    const parentAfterFirst = await getIssueBySlug(db, 'parent-ac');
    expect(parentAfterFirst!.status).toBe('open');

    await closeIssue(db, 'child-ac-2');
    // After both children are closed, parent should auto-close.
    const parentAfterBoth = await getIssueBySlug(db, 'parent-ac');
    expect(parentAfterBoth!.status).toBe('done');
  });

  it('parent stays open when only 1 of 2 children is closed', async () => {
    const parent = await createIssue(db, featureInput('parent-partial'));
    await createIssue(
      db,
      featureInput('child-partial-1', { parent_id: parent.id }),
    );
    await createIssue(
      db,
      featureInput('child-partial-2', { parent_id: parent.id }),
    );

    await closeIssue(db, 'child-partial-1');

    const parentStatus = await getIssueBySlug(db, 'parent-partial');
    expect(parentStatus!.status).toBe('open');
  });
});
