// src/checkpoints/__tests__/projection.test.ts
//
// Filesystem integration test for writeCheckpointFile.
// Verifies directory creation, filename convention, and markdown content.

import { describe, test, expect, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, readFile } from 'node:fs/promises';

import { writeCheckpointFile } from '../projection.js';
import type { Checkpoint } from '../crud.js';

// ── Helpers ───────────────────────────────────────────────────────────────

let basePath: string;

function makeCheckpoint(overrides?: Partial<Checkpoint>): Checkpoint {
  return {
    id: 'abcdef01-2345-6789-abcd-ef0123456789',
    number: 1,
    issue_slug: null,
    summary: 'Test summary',
    content: 'Test content body',
    created_at: '2026-04-03T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(async () => {
  if (basePath) {
    await rm(basePath, { recursive: true, force: true });
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('writeCheckpointFile', () => {
  test('creates checkpoints directory and writes file with correct name', async () => {
    basePath = join(tmpdir(), `tw-ckpt-test-${randomUUID()}`);
    const checkpoint = makeCheckpoint();

    await writeCheckpointFile(checkpoint, basePath);

    // Filename: {number}-{first 8 chars of id}.md
    const filePath = join(basePath, 'checkpoints', '1-abcdef01.md');
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('# Checkpoint #1');
    expect(content).toContain('Test summary');
    expect(content).toContain('Test content body');
  });

  test('uses sequential number in filename', async () => {
    basePath = join(tmpdir(), `tw-ckpt-test-${randomUUID()}`);
    const checkpoint = makeCheckpoint({ number: 42 });

    await writeCheckpointFile(checkpoint, basePath);

    const filePath = join(basePath, 'checkpoints', '42-abcdef01.md');
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('# Checkpoint #42');
  });

  test('is idempotent — overwrites existing file', async () => {
    basePath = join(tmpdir(), `tw-ckpt-test-${randomUUID()}`);
    const checkpoint = makeCheckpoint({ summary: 'Version 1' });

    await writeCheckpointFile(checkpoint, basePath);
    await writeCheckpointFile(
      makeCheckpoint({ summary: 'Version 2' }),
      basePath,
    );

    const filePath = join(basePath, 'checkpoints', '1-abcdef01.md');
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('Version 2');
    expect(content).not.toContain('Version 1');
  });

  test('includes issue_slug when present', async () => {
    basePath = join(tmpdir(), `tw-ckpt-test-${randomUUID()}`);
    const checkpoint = makeCheckpoint({ issue_slug: 'feat-auth' });

    await writeCheckpointFile(checkpoint, basePath);

    const filePath = join(basePath, 'checkpoints', '1-abcdef01.md');
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('feat-auth');
  });
});
