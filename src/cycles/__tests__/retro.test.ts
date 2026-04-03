// src/cycles/__tests__/retro.test.ts
//
// Pure function tests for generateRetro(). No DB, no I/O.

import { describe, it, expect } from 'vitest';
import { generateRetro } from '../retro.js';
import type { RetroData } from '../retro.js';
import type { Cycle, CycleId } from '../../types/cycle.js';
import type { Issue, IssueId } from '../../types/issue.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    id: 'cycle-001' as CycleId,
    slug: 'sprint-1',
    title: 'Sprint 1',
    description: null,
    status: 'closed',
    started_at: '2026-04-01T00:00:00.000Z',
    closed_at: '2026-04-07T00:00:00.000Z',
    ...overrides,
  };
}

function makeIssue(slug: string, step = 'build', overrides: Partial<Issue> = {}): Issue {
  return {
    id: `id-${slug}` as IssueId,
    slug,
    title: `Issue ${slug}`,
    body: null,
    type: 'feature',
    workflow_id: 'feature',
    step,
    status: 'done',
    parent_id: null,
    metadata: {},
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRetroData(overrides: Partial<RetroData> = {}): RetroData {
  return {
    cycle: makeCycle(),
    completed: [makeIssue('feat-login'), makeIssue('feat-signup')],
    carried_over: [makeIssue('feat-billing', 'research', { status: 'open' })],
    summary: 'Good sprint. Delivered login and signup flows.',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('generateRetro', () => {
  it('contains the cycle title', () => {
    const retro = generateRetro(makeRetroData());
    expect(retro).toContain('# Retro: Sprint 1');
  });

  it('contains completed issue slugs', () => {
    const retro = generateRetro(makeRetroData());
    expect(retro).toContain('feat-login');
    expect(retro).toContain('feat-signup');
  });

  it('contains carried-over issue slugs with step', () => {
    const retro = generateRetro(makeRetroData());
    expect(retro).toContain('feat-billing');
    expect(retro).toContain('step: research');
  });

  it('renders "None" when completed list is empty', () => {
    const retro = generateRetro(makeRetroData({ completed: [] }));
    expect(retro).toContain('## Completed (0)');
    expect(retro).toContain('_None_');
    // Should not contain any checkmark lines
    expect(retro).not.toContain('✓');
  });

  it('renders "None" when carried-over list is empty', () => {
    const retro = generateRetro(makeRetroData({ carried_over: [] }));
    expect(retro).toContain('## Carried Over (0)');
    // The section after the "## Carried Over" heading should contain _None_
    const sections = retro.split('## Carried Over');
    expect(sections[1]).toContain('_None_');
    // No carried-over issue lines (lines starting with "- →")
    const carriedLines = retro.split('\n').filter((l) => l.startsWith('- →'));
    expect(carriedLines).toHaveLength(0);
  });

  it('includes the period line with started_at and closed_at', () => {
    const retro = generateRetro(makeRetroData());
    expect(retro).toContain('2026-04-01T00:00:00.000Z');
    expect(retro).toContain('2026-04-07T00:00:00.000Z');
  });

  it('includes the summary text', () => {
    const retro = generateRetro(
      makeRetroData({ summary: 'Shipped auth, skipped billing.' }),
    );
    expect(retro).toContain('Shipped auth, skipped billing.');
  });
});
