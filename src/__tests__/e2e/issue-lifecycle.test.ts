// src/__tests__/e2e/issue-lifecycle.test.ts
//
// End-to-end lifecycle: issue open -> advance -> close.
// Also covers closeIssue, archiveIssue, parent auto-close, listIssues filters,
// and config validation.
//
// Uses vi.mock to replace DEFAULT_CONFIG with test workflows whose steps have
// done_when expressions that the engine can evaluate.
//
// Engine constraint: txNext loads vars only for the current step (not prior
// steps), so the evaluator always has the current step's vars in scope.
// Workflows with `done_when: "true"` on every step complete entirely in a
// single txNext call. To test per-step advancement, we use a 2-step
// workflow where only step-a has done_when and step-b has none.

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, stat } from 'node:fs/promises';

// Mock DEFAULT_CONFIG before importing anything that depends on it.
//
// Workflows:
//   feature — all steps auto-complete (done_when: "true"), completing the
//             whole workflow in a single txNext call.
//   test-two-step — step-a auto-completes, step-b has no condition.
//             A single txNext advances from step-a to step-b (but does not
//             complete the workflow).
vi.mock('../../config/defaults.js', () => ({
  DEFAULT_CONFIG: {
    version: '4.0',
    workflows: [
      {
        id: 'feature',
        title: 'Feature',
        default_for: ['feature'],
        steps: [
          { id: 'research', title: 'Research', needs: [], done_when: 'true' },
          { id: 'scope', title: 'Scope', needs: ['research'], done_when: 'true' },
          { id: 'plan', title: 'Plan', needs: ['scope'], done_when: 'true' },
          { id: 'build', title: 'Build', needs: ['plan'], done_when: 'true' },
        ],
      },
      {
        id: 'test-two-step',
        title: 'Two Step',
        default_for: [],
        steps: [
          { id: 'step-a', title: 'Step A', needs: [], done_when: 'true' },
          { id: 'step-b', title: 'Step B', needs: ['step-a'] },
        ],
      },
      {
        id: 'bug',
        title: 'Bug',
        default_for: ['bug'],
        steps: [
          { id: 'reproduce', title: 'Reproduce', needs: [] },
          { id: 'fix', title: 'Fix', needs: ['reproduce'] },
          { id: 'verify', title: 'Verify', needs: ['fix'] },
        ],
      },
      {
        id: 'chore',
        title: 'Chore',
        default_for: ['chore'],
        steps: [
          { id: 'do', title: 'Do', needs: [] },
        ],
      },
      {
        id: 'spike',
        title: 'Spike',
        default_for: ['spike'],
        steps: [
          { id: 'research', title: 'Research', needs: [] },
          { id: 'recommend', title: 'Recommend', needs: ['research'] },
        ],
      },
    ],
    context_skills: [],
    step_skills: {},
    step_review_skills: {},
  },
}));

import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import { MarkdownProjectionAdapter } from '../../adapters/markdown/adapter.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { txNext } from '../../engine/state.js';
import {
  createIssue,
  getIssueBySlug,
  closeIssue,
  archiveIssue,
  listIssues,
} from '../../issues/crud.js';

// ── Helpers ───────────────────────────────────────────────────────────────

async function createTestEnv() {
  const db = await createInMemoryStorageAdapter();
  const basePath = join(tmpdir(), `twisted-e2e-${randomUUID()}`);
  const projection = new MarkdownProjectionAdapter(db, basePath);
  return { db, projection, basePath, cleanup: () => rm(basePath, { recursive: true, force: true }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('issue lifecycle E2E', () => {
  let db: PGLiteStorageAdapter;
  let projection: MarkdownProjectionAdapter;
  let basePath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const env = await createTestEnv();
    db = env.db;
    projection = env.projection;
    basePath = env.basePath;
    cleanup = env.cleanup;
  });

  // 1. Full feature lifecycle: open -> txNext completes all steps -> done
  //
  // The feature workflow has done_when: "true" on every step, so a single
  // txNext call evaluates all steps as done and closes the issue.
  test('feature issue completes all steps to done via txNext', async () => {
    try {
      const issue = await createIssue(db, {
        slug: 'my-feature',
        title: 'My Feature',
        type: 'feature',
        workflow_id: 'feature',
      });
      expect(issue.step).toBe('research');
      expect(issue.status).toBe('open');

      // All steps have done_when: "true", so one txNext call completes the workflow.
      const result = await txNext(db, projection, { issue_slug: 'my-feature' });
      expect(result.status).toBe('done');

      // Issue is done in DB
      const closed = await getIssueBySlug(db, 'my-feature');
      expect(closed?.status).toBe('done');

      // Projection created the issue markdown file
      const issueFile = join(basePath, 'issues', 'my-feature.md');
      await expect(stat(issueFile)).resolves.toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  // 2. Two-step advancement: txNext advances one step at a time
  //
  // test-two-step workflow: step-a (done_when: "true") -> step-b (no condition).
  // First txNext advances from step-a to step-b (advanced).
  // Second txNext returns no_change (step-b has no done_when to complete it).
  test('txNext advances one step when only the current step is done', async () => {
    try {
      const issue = await createIssue(db, {
        slug: 'two-step',
        title: 'Two Stepper',
        type: 'feature',
        workflow_id: 'test-two-step',
      });
      expect(issue.step).toBe('step-a');

      // First call: step-a's done_when is "true" -> advances to step-b
      const r1 = await txNext(db, projection, { issue_slug: 'two-step' });
      expect(r1.status).toBe('advanced');
      if (r1.status === 'advanced') {
        expect(r1.from_step).toBe('step-a');
        expect(r1.to_step).toBe('step-b');
      }

      // Second call: step-b has no done_when -> no_change
      const r2 = await txNext(db, projection, { issue_slug: 'two-step' });
      expect(r2.status).toBe('no_change');

      // Verify DB state
      const fromDb = await getIssueBySlug(db, 'two-step');
      expect(fromDb?.step).toBe('step-b');
      expect(fromDb?.status).toBe('open');
    } finally {
      await cleanup();
    }
  });

  // 3. closeIssue directly sets status to done
  test('closeIssue directly sets status to done without stepping', async () => {
    try {
      const issue = await createIssue(db, {
        slug: 'direct-close',
        title: 'Direct Close',
        type: 'feature',
        workflow_id: 'feature',
      });
      expect(issue.status).toBe('open');

      const closed = await closeIssue(db, 'direct-close');
      expect(closed.status).toBe('done');

      const fromDb = await getIssueBySlug(db, 'direct-close');
      expect(fromDb?.status).toBe('done');
    } finally {
      await cleanup();
    }
  });

  // 4. archiveIssue sets status to archived
  test('archiveIssue sets status to archived', async () => {
    try {
      await createIssue(db, {
        slug: 'to-archive',
        title: 'Archive Me',
        type: 'feature',
        workflow_id: 'feature',
      });

      const archived = await archiveIssue(db, 'to-archive');
      expect(archived.status).toBe('archived');

      const fromDb = await getIssueBySlug(db, 'to-archive');
      expect(fromDb?.status).toBe('archived');
    } finally {
      await cleanup();
    }
  });

  // 5. Parent auto-closes when all children close
  test('parent auto-closes when all children close', async () => {
    try {
      const parent = await createIssue(db, {
        slug: 'parent-issue',
        title: 'Parent Issue',
        type: 'feature',
        workflow_id: 'feature',
      });
      expect(parent.status).toBe('open');

      await createIssue(db, {
        slug: 'child-a',
        title: 'Child A',
        type: 'feature',
        workflow_id: 'feature',
        parent_id: parent.id,
      });

      await createIssue(db, {
        slug: 'child-b',
        title: 'Child B',
        type: 'feature',
        workflow_id: 'feature',
        parent_id: parent.id,
      });

      // Close first child -- parent stays open
      await closeIssue(db, 'child-a');
      const parentAfterOne = await getIssueBySlug(db, 'parent-issue');
      expect(parentAfterOne?.status).toBe('open');

      // Close second child -- parent auto-closes
      await closeIssue(db, 'child-b');
      const parentAfterAll = await getIssueBySlug(db, 'parent-issue');
      expect(parentAfterAll?.status).toBe('done');
    } finally {
      await cleanup();
    }
  });

  // 6. listIssues filter by status
  test('listIssues filters by status', async () => {
    try {
      await createIssue(db, {
        slug: 'open-1',
        title: 'Open 1',
        type: 'feature',
        workflow_id: 'feature',
      });
      await createIssue(db, {
        slug: 'open-2',
        title: 'Open 2',
        type: 'feature',
        workflow_id: 'feature',
      });
      await createIssue(db, {
        slug: 'to-close',
        title: 'Will Close',
        type: 'feature',
        workflow_id: 'feature',
      });

      await closeIssue(db, 'to-close');

      const openIssues = await listIssues(db, { status: 'open' });
      expect(openIssues).toHaveLength(2);
      expect(openIssues.map((i) => i.slug).sort()).toEqual(['open-1', 'open-2']);

      const doneIssues = await listIssues(db, { status: 'done' });
      expect(doneIssues).toHaveLength(1);
      expect(doneIssues[0]!.slug).toBe('to-close');
    } finally {
      await cleanup();
    }
  });

  // 7. listIssues filter by type
  test('listIssues filters by type', async () => {
    try {
      await createIssue(db, {
        slug: 'feat-one',
        title: 'Feature One',
        type: 'feature',
        workflow_id: 'feature',
      });
      await createIssue(db, {
        slug: 'bug-one',
        title: 'Bug One',
        type: 'bug',
        workflow_id: 'bug',
      });

      const features = await listIssues(db, { type: 'feature' });
      expect(features).toHaveLength(1);
      expect(features[0]!.slug).toBe('feat-one');

      const bugs = await listIssues(db, { type: 'bug' });
      expect(bugs).toHaveLength(1);
      expect(bugs[0]!.slug).toBe('bug-one');
    } finally {
      await cleanup();
    }
  });

  // 8. txNext returns error for unknown slug
  test('txNext returns error for unknown slug', async () => {
    try {
      const result = await txNext(db, projection, { issue_slug: 'nonexistent' });
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('nonexistent');
      }
    } finally {
      await cleanup();
    }
  });

  // 9. validateConfig accepts the mocked DEFAULT_CONFIG
  test('validateConfig accepts the mocked DEFAULT_CONFIG', async () => {
    const { DEFAULT_CONFIG } = await import('../../config/defaults.js');
    const { validateConfig } = await import('../../config/validator.js');

    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.ok).toBe(true);
  });
});
