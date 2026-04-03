// src/__tests__/e2e/checkpoints.test.ts
//
// End-to-end checkpoint flow: create checkpoints, retrieve latest,
// verify sequential numbering, and issue-scoped queries.

import { describe, test, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue } from '../../issues/crud.js';
import {
  createCheckpoint,
  getLatestCheckpoint,
  getCheckpoint,
  listCheckpoints,
} from '../../checkpoints/crud.js';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('checkpoints E2E', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  // 1. Checkpoint captures context and can be retrieved
  test('checkpoint captures context and can be retrieved', async () => {
    const issue = await createIssue(db, {
      slug: 'wip',
      title: 'Work in Progress',
      type: 'feature',
      workflow_id: 'feature',
    });

    // Create checkpoint (simulating session handoff)
    const cp = await createCheckpoint(db, {
      issue_slug: issue.slug,
      summary: 'Completed research, starting scope',
      content: '## What was done\n\nResearch complete.\n\n## Next\n\nScope the feature.',
    });
    expect(cp.number).toBe(1);
    expect(cp.issue_slug).toBe('wip');
    expect(cp.summary).toBe('Completed research, starting scope');
    expect(cp.content).toContain('Research complete');

    // Retrieve latest checkpoint (simulating session pickup)
    const latest = await getLatestCheckpoint(db, issue.slug);
    expect(latest).not.toBeNull();
    expect(latest!.summary).toBe('Completed research, starting scope');
    expect(latest!.number).toBe(1);

    // Retrieve by ID
    const byId = await getCheckpoint(db, cp.id);
    expect(byId).not.toBeNull();
    expect(byId!.id).toBe(cp.id);
    expect(byId!.content).toBe(cp.content);
  });

  // 2. Second checkpoint increments number
  test('second checkpoint increments number', async () => {
    const issue = await createIssue(db, {
      slug: 'incrementing',
      title: 'Incrementing Checkpoints',
      type: 'feature',
      workflow_id: 'feature',
    });

    const cp1 = await createCheckpoint(db, {
      issue_slug: issue.slug,
      summary: 'First checkpoint',
      content: 'First content',
    });
    expect(cp1.number).toBe(1);

    const cp2 = await createCheckpoint(db, {
      issue_slug: issue.slug,
      summary: 'Second checkpoint',
      content: 'Second content',
    });
    expect(cp2.number).toBe(2);

    // Latest returns the most recent
    const latest = await getLatestCheckpoint(db, issue.slug);
    expect(latest!.number).toBe(2);
    expect(latest!.summary).toBe('Second checkpoint');
  });

  // 3. Checkpoints without issue_slug (global checkpoints)
  test('checkpoints without issue_slug work as global checkpoints', async () => {
    const cp = await createCheckpoint(db, {
      summary: 'Global checkpoint',
      content: 'Session context without a specific issue.',
    });

    expect(cp.issue_slug).toBeNull();
    expect(cp.number).toBe(1);

    // Global latest retrieval
    const latest = await getLatestCheckpoint(db);
    expect(latest).not.toBeNull();
    expect(latest!.summary).toBe('Global checkpoint');
  });

  // 4. listCheckpoints returns all in descending number order
  test('listCheckpoints returns all in descending number order', async () => {
    await createCheckpoint(db, {
      summary: 'First',
      content: 'Content 1',
    });
    await createCheckpoint(db, {
      summary: 'Second',
      content: 'Content 2',
    });
    await createCheckpoint(db, {
      summary: 'Third',
      content: 'Content 3',
    });

    const all = await listCheckpoints(db);
    expect(all).toHaveLength(3);
    // Descending order
    expect(all[0]!.number).toBe(3);
    expect(all[1]!.number).toBe(2);
    expect(all[2]!.number).toBe(1);
  });

  // 5. Issue-scoped checkpoints are separate from others
  test('issue-scoped checkpoints are filtered correctly', async () => {
    const issueA = await createIssue(db, {
      slug: 'issue-a',
      title: 'Issue A',
      type: 'feature',
      workflow_id: 'feature',
    });
    const issueB = await createIssue(db, {
      slug: 'issue-b',
      title: 'Issue B',
      type: 'feature',
      workflow_id: 'feature',
    });

    await createCheckpoint(db, {
      issue_slug: issueA.slug,
      summary: 'Checkpoint for A',
      content: 'A content',
    });
    await createCheckpoint(db, {
      issue_slug: issueB.slug,
      summary: 'Checkpoint for B',
      content: 'B content',
    });
    await createCheckpoint(db, {
      summary: 'Global checkpoint',
      content: 'Global content',
    });

    // Issue-scoped queries
    const cpA = await listCheckpoints(db, issueA.slug);
    expect(cpA).toHaveLength(1);
    expect(cpA[0]!.summary).toBe('Checkpoint for A');

    const cpB = await listCheckpoints(db, issueB.slug);
    expect(cpB).toHaveLength(1);
    expect(cpB[0]!.summary).toBe('Checkpoint for B');

    // Global query returns all
    const all = await listCheckpoints(db);
    expect(all).toHaveLength(3);

    // Latest for issue A
    const latestA = await getLatestCheckpoint(db, issueA.slug);
    expect(latestA!.summary).toBe('Checkpoint for A');

    // Latest globally
    const latestGlobal = await getLatestCheckpoint(db);
    expect(latestGlobal!.number).toBe(3);
  });

  // 6. getCheckpoint returns null for unknown ID
  test('getCheckpoint returns null for unknown ID', async () => {
    const result = await getCheckpoint(db, 'non-existent-id');
    expect(result).toBeNull();
  });

  // 7. getLatestCheckpoint returns null when no checkpoints exist
  test('getLatestCheckpoint returns null when no checkpoints exist', async () => {
    const result = await getLatestCheckpoint(db);
    expect(result).toBeNull();

    const resultScoped = await getLatestCheckpoint(db, 'no-such-issue');
    expect(resultScoped).toBeNull();
  });
});
