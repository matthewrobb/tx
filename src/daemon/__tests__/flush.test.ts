// src/daemon/__tests__/flush.test.ts — Unit tests for ProjectionFlusher.
//
// Tests the dirty tracking and batched flush behavior. Uses a mock
// ProjectionPort — no real DB or filesystem involved.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { ProjectionPort } from '../../ports/projection.js';
import { ProjectionFlusher } from '../flush.js';

function createMockProjection(): ProjectionPort {
  return {
    renderIssue: vi.fn<(slug: string) => Promise<void>>().mockResolvedValue(undefined),
    renderCycle: vi.fn<(slug: string) => Promise<void>>().mockResolvedValue(undefined),
    renderCheckpoint: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
    renderSnapshot: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteIssue: vi.fn<(slug: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('ProjectionFlusher', () => {
  let projection: ProjectionPort;
  let flusher: ProjectionFlusher;

  beforeEach(() => {
    projection = createMockProjection();
    flusher = new ProjectionFlusher(projection);
  });

  test('markDirty + flush calls renderIssue for dirty slugs', async () => {
    flusher.markDirty('issue-a');
    flusher.markDirty('issue-b');

    await flusher.flush();

    expect(projection.renderIssue).toHaveBeenCalledTimes(2);
    expect(projection.renderIssue).toHaveBeenCalledWith('issue-a');
    expect(projection.renderIssue).toHaveBeenCalledWith('issue-b');
  });

  test('multiple markDirty for the same slug results in a single renderIssue call', async () => {
    flusher.markDirty('issue-x');
    flusher.markDirty('issue-x');
    flusher.markDirty('issue-x');

    await flusher.flush();

    expect(projection.renderIssue).toHaveBeenCalledTimes(1);
    expect(projection.renderIssue).toHaveBeenCalledWith('issue-x');
  });

  test('flush with empty dirty set does not call renderIssue', async () => {
    await flusher.flush();

    expect(projection.renderIssue).not.toHaveBeenCalled();
  });

  test('flush clears the dirty set so subsequent flush is a no-op', async () => {
    flusher.markDirty('issue-a');
    await flusher.flush();
    await flusher.flush();

    expect(projection.renderIssue).toHaveBeenCalledTimes(1);
  });

  test('flush swallows renderIssue errors without throwing', async () => {
    vi.mocked(projection.renderIssue).mockRejectedValueOnce(new Error('disk full'));
    flusher.markDirty('issue-fail');

    // Should not throw.
    await expect(flusher.flush()).resolves.toBeUndefined();
  });

  test('stop flushes remaining dirty slugs', async () => {
    flusher.start();
    flusher.markDirty('issue-final');

    await flusher.stop();

    expect(projection.renderIssue).toHaveBeenCalledTimes(1);
    expect(projection.renderIssue).toHaveBeenCalledWith('issue-final');
  });
});
