// src/daemon/__tests__/cycle-handlers.test.ts
//
// RED tests for cycle daemon handlers: handleCycleStart, handleCyclePull, handleCycleClose.
// These test the handler layer directly — not the socket — using a real PGLite adapter.

import { describe, test, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue, closeIssue } from '../../issues/crud.js';
import {
  handleCycleStart,
  handleCyclePull,
  handleCycleClose,
} from '../handlers.js';

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

describe('handleCycleStart', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  test('starts a new cycle and returns it', async () => {
    const res = await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
    });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    const data = res.data as { slug: string; status: string; title: string };
    expect(data.slug).toBe('sprint-1');
    expect(data.title).toBe('Sprint 1');
    expect(data.status).toBe('active');
  });

  test('returns error when a cycle is already active', async () => {
    await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
    });

    const res = await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-2',
      title: 'Sprint 2',
    });

    expect(res.status).toBe('error');
    if (res.status !== 'error') return;
    expect(res.message).toMatch(/already active/i);
  });

  test('passes description through', async () => {
    const res = await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
      description: 'Focus on auth',
    });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    const data = res.data as { description: string | null };
    expect(data.description).toBe('Focus on auth');
  });
});

describe('handleCyclePull', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  test('pulls issues into the active cycle', async () => {
    await createIssue(db, featureInput('feat-a'));
    await createIssue(db, featureInput('feat-b'));

    await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
    });

    const res = await handleCyclePull(db, {
      command: 'cycle_pull',
      issue_slugs: ['feat-a', 'feat-b'],
    });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    const data = res.data as { pulled: unknown[]; skipped: unknown[] };
    expect(data.pulled).toHaveLength(2);
    expect(data.skipped).toHaveLength(0);
  });

  test('auto-pulls all open issues when issue_slugs is empty', async () => {
    await createIssue(db, featureInput('feat-a'));
    await createIssue(db, featureInput('feat-b'));

    await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
    });

    const res = await handleCyclePull(db, {
      command: 'cycle_pull',
      issue_slugs: [],
    });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    const data = res.data as { pulled: unknown[] };
    expect(data.pulled).toHaveLength(2);
  });

  test('returns error when no cycle is active', async () => {
    const res = await handleCyclePull(db, {
      command: 'cycle_pull',
      issue_slugs: [],
    });

    expect(res.status).toBe('error');
    if (res.status !== 'error') return;
    expect(res.message).toMatch(/no active cycle/i);
  });
});

describe('handleCycleClose', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  test('closes the active cycle with retro and checkpoint', async () => {
    await createIssue(db, featureInput('feat-a'));

    await handleCycleStart(db, {
      command: 'cycle_start',
      slug: 'sprint-1',
      title: 'Sprint 1',
    });

    await handleCyclePull(db, {
      command: 'cycle_pull',
      issue_slugs: ['feat-a'],
    });

    // Close the issue so it counts as completed
    await closeIssue(db, 'feat-a');

    const res = await handleCycleClose(db, {
      command: 'cycle_close',
      summary: 'Good sprint',
    });

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    const data = res.data as {
      cycle: { status: string };
      retro: string;
      checkpointId: string;
      completed: number;
      carried_over: number;
    };
    expect(data.cycle.status).toBe('closed');
    expect(data.retro).toContain('Sprint 1');
    expect(data.checkpointId).toBeDefined();
    expect(data.completed).toBe(1);
    expect(data.carried_over).toBe(0);
  });

  test('returns error when no cycle is active', async () => {
    const res = await handleCycleClose(db, {
      command: 'cycle_close',
      summary: 'Nothing here',
    });

    expect(res.status).toBe('error');
    if (res.status !== 'error') return;
    expect(res.message).toMatch(/no active cycle/i);
  });
});
