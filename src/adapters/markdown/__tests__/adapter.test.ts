// src/adapters/markdown/__tests__/adapter.test.ts
//
// Integration tests for MarkdownProjectionAdapter: real PGLite + real filesystem.
// Covers renderCycle, renderCheckpoint, renderSnapshot, and deleteIssue —
// the adapter methods that had zero filesystem test coverage.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, readFile, writeFile, mkdir, stat } from 'node:fs/promises';

import { createInMemoryStorageAdapter } from '../../pglite/index.js';
import type { PGLiteStorageAdapter } from '../../pglite/adapter.js';
import { MarkdownProjectionAdapter } from '../adapter.js';
import { createIssue } from '../../../issues/crud.js';
import { createCheckpoint } from '../../../checkpoints/crud.js';

// ── Helpers ───────────────────────────────────────────────────────────────

let db: PGLiteStorageAdapter;
let basePath: string;
let adapter: MarkdownProjectionAdapter;

beforeEach(async () => {
  db = await createInMemoryStorageAdapter();
  basePath = join(tmpdir(), `tw-adapter-test-${randomUUID()}`);
  adapter = new MarkdownProjectionAdapter(db, basePath);
});

afterEach(async () => {
  await rm(basePath, { recursive: true, force: true });
});

async function seedCycle(slug: string, title: string, status = 'active'): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO cycles (id, slug, title, status, started_at, closed_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, slug, title, status, now, status === 'closed' ? now : null],
  );
  return id;
}

// ── renderCycle ───────────────────────────────────────────────────────────

describe('renderCycle', () => {
  test('creates cycles directory and writes markdown file', async () => {
    await seedCycle('sprint-1', 'Sprint 1');

    await adapter.renderCycle('sprint-1');

    const filePath = join(basePath, 'cycles', 'sprint-1.md');
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Sprint 1');
    expect(content).toContain('active');
  });

  test('includes issue counts for cycles with pulled issues', async () => {
    const cycleId = await seedCycle('sprint-2', 'Sprint 2');
    const issue = await createIssue(db, {
      slug: 'feat-x',
      title: 'Feature X',
      type: 'feature',
      workflow_id: 'feature',
    });

    await db.query(
      `INSERT INTO cycle_issues (cycle_id, issue_id, pulled_at) VALUES ($1, $2, $3)`,
      [cycleId, issue.id, new Date().toISOString()],
    );

    await adapter.renderCycle('sprint-2');

    const content = await readFile(join(basePath, 'cycles', 'sprint-2.md'), 'utf8');
    expect(content).toContain('1'); // total count
  });

  test('throws when cycle slug not found', async () => {
    await expect(adapter.renderCycle('no-such-cycle')).rejects.toThrow(/not found/i);
  });
});

// ── renderCheckpoint ──────────────────────────────────────────────────────

describe('renderCheckpoint', () => {
  test('creates checkpoints directory and writes markdown file', async () => {
    const checkpoint = await createCheckpoint(db, {
      summary: 'Test checkpoint',
      content: 'Checkpoint detail content',
    });

    await adapter.renderCheckpoint(checkpoint.id);

    // Filename is {number}-{id_prefix}.md
    const prefix = checkpoint.id.slice(0, 8);
    const filePath = join(basePath, 'checkpoints', `${checkpoint.number}-${prefix}.md`);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Test checkpoint');
    expect(content).toContain('Checkpoint detail content');
  });

  test('throws when checkpoint ID not found', async () => {
    await expect(adapter.renderCheckpoint('no-such-id')).rejects.toThrow(/not found/i);
  });
});

// ── renderSnapshot ────────────────────────────────────────────────────────

describe('renderSnapshot', () => {
  test('creates snapshot.md in basePath', async () => {
    await createIssue(db, {
      slug: 'feat-a',
      title: 'Feature A',
      type: 'feature',
      workflow_id: 'feature',
    });

    await adapter.renderSnapshot();

    const content = await readFile(join(basePath, 'snapshot.md'), 'utf8');
    expect(content).toContain('feat-a');
    expect(content).toContain('Feature A');
  });

  test('renders empty table when no issues exist', async () => {
    await adapter.renderSnapshot();

    const content = await readFile(join(basePath, 'snapshot.md'), 'utf8');
    // Should still create the file — just with headers and no rows.
    expect(content).toBeDefined();
  });
});

// ── deleteIssue ───────────────────────────────────────────────────────────

describe('deleteIssue', () => {
  test('deletes the markdown file for an issue', async () => {
    // Create the file first via renderIssue.
    await createIssue(db, {
      slug: 'doomed',
      title: 'Doomed Issue',
      type: 'feature',
      workflow_id: 'feature',
    });
    await adapter.renderIssue('doomed');

    const filePath = join(basePath, 'issues', 'doomed.md');
    // File should exist after render.
    await expect(stat(filePath)).resolves.toBeDefined();

    // Delete it.
    await adapter.deleteIssue('doomed');

    // File should be gone.
    await expect(stat(filePath)).rejects.toThrow(/ENOENT/);
  });

  test('does not throw when file does not exist (ENOENT)', async () => {
    // Should not throw — file never existed.
    await expect(adapter.deleteIssue('never-existed')).resolves.toBeUndefined();
  });
});
