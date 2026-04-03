// src/adapters/markdown/__tests__/renderer.test.ts
//
// Unit tests for renderer.ts pure functions.
// No DB, no filesystem, no mocking — just data in, string out.

import { describe, it, expect } from 'vitest';
import { renderIssue, renderCycle, renderSnapshot } from '../renderer.js';
import type { Note, Task } from '../renderer.js';
import type { Issue } from '../../../types/issue.js';
import type { IssueId } from '../../../types/issue.js';
import type { Cycle } from '../../../types/cycle.js';
import type { CycleId } from '../../../types/cycle.js';

// ── Fixtures ──────────────────────────────────────────────────

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-001' as IssueId,
    slug: 'my-feature',
    title: 'My Feature',
    body: 'A description.',
    type: 'feature',
    workflow_id: 'default',
    step: 'build',
    status: 'open',
    parent_id: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: 'cycle-001' as CycleId,
    slug: 'sprint-1',
    title: 'Sprint 1',
    description: null,
    status: 'active',
    started_at: '2026-01-01T00:00:00.000Z',
    closed_at: null,
    ...overrides,
  };
}

const NOTE_DECIDE: Note = {
  id: 'n-001',
  summary: 'Use PGLite',
  tag: 'decide',
  created_at: '2026-01-05T12:00:00.000Z',
};

const TASK_DONE: Task = {
  id: 'T-001',
  summary: 'completed task',
  done: true,
  created_at: '2026-01-03T00:00:00.000Z',
};

const TASK_PENDING: Task = {
  id: 'T-002',
  summary: 'pending task',
  done: false,
  created_at: '2026-01-04T00:00:00.000Z',
};

// ── renderIssue ───────────────────────────────────────────────

describe('renderIssue', () => {
  it('contains title, type, status, step', () => {
    const md = renderIssue(makeIssue(), [], []);

    expect(md).toContain('# My Feature');
    expect(md).toContain('**Type:** feature');
    expect(md).toContain('**Status:** open');
    expect(md).toContain('**Step:** build');
  });

  it('renders done task as [x] and pending task as [ ]', () => {
    const md = renderIssue(makeIssue(), [], [TASK_DONE, TASK_PENDING]);

    expect(md).toContain('- [x] T-001 completed task');
    expect(md).toContain('- [ ] T-002 pending task');
  });

  it('falls back to "*No description.*" when body is null', () => {
    const md = renderIssue(makeIssue({ body: null }), [], []);

    expect(md).toContain('*No description.*');
    // Should not contain the Body section with actual text
    expect(md).not.toContain('A description.');
  });

  it('renders notes with tag label and summary', () => {
    const md = renderIssue(makeIssue(), [NOTE_DECIDE], []);

    expect(md).toContain('### [decide] Use PGLite');
    // Date should be the ISO date portion only
    expect(md).toContain('*2026-01-05*');
  });

  it('renders "*No tasks.*" when tasks array is empty', () => {
    const md = renderIssue(makeIssue(), [], []);

    expect(md).toContain('*No tasks.*');
  });

  it('renders "*No notes.*" when notes array is empty', () => {
    const md = renderIssue(makeIssue(), [], []);

    expect(md).toContain('*No notes.*');
  });
});

// ── renderCycle ───────────────────────────────────────────────

describe('renderCycle', () => {
  it('contains title, status, and issue counts', () => {
    const md = renderCycle(makeCycle(), 5, 3);

    expect(md).toContain('# Sprint 1');
    expect(md).toContain('**Status:** active');
    expect(md).toContain('5 total, 3 completed');
  });

  it('shows "active" for closed_at when cycle is still open', () => {
    const md = renderCycle(makeCycle({ closed_at: null }), 0, 0);

    expect(md).toContain('**Closed:** active');
  });

  it('shows the closed_at timestamp when the cycle is closed', () => {
    const md = renderCycle(
      makeCycle({ status: 'closed', closed_at: '2026-01-15T00:00:00.000Z' }),
      4,
      4,
    );

    expect(md).toContain('**Closed:** 2026-01-15T00:00:00.000Z');
    expect(md).toContain('4 total, 4 completed');
  });
});

// ── renderSnapshot ────────────────────────────────────────────

describe('renderSnapshot', () => {
  it('renders a table row for each issue', () => {
    const issues = [
      makeIssue({ slug: 'my-feature', title: 'My Feature', type: 'feature', step: 'build', status: 'open' }),
      makeIssue({ id: 'issue-002' as IssueId, slug: 'fix-bug', title: 'Fix Bug', type: 'bug', step: 'research', status: 'blocked' }),
    ];

    const md = renderSnapshot(issues);

    expect(md).toContain('# Active Issues');
    expect(md).toContain('| my-feature | My Feature | feature | build | open |');
    expect(md).toContain('| fix-bug | Fix Bug | bug | research | blocked |');
  });

  it('renders an empty table (header only) when the issue list is empty', () => {
    const md = renderSnapshot([]);

    expect(md).toContain('# Active Issues');
    // Table header row must be present
    expect(md).toContain('| Slug | Title | Type | Step | Status |');
    expect(md).toContain('|------|-------|------|------|--------|');
    // No data rows beyond the header
    const lines = md.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('| Slug') && !l.startsWith('|---'));
    expect(lines).toHaveLength(0);
  });
});
