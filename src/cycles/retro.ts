// src/cycles/retro.ts — Pure markdown retro generator for cycle close.
//
// No I/O. generateRetro() takes a RetroData snapshot and returns a markdown
// string. Keeping this pure makes it trivially testable and easy to preview
// without touching the database.

import type { Cycle } from '../types/cycle.js';
import type { Issue } from '../types/issue.js';

export interface RetroData {
  cycle: Cycle;
  completed: Issue[];
  carried_over: Issue[];
  summary: string;
}

/**
 * Generate a markdown retro document from cycle data.
 *
 * Pure function — no side effects, no I/O. The caller (closeCycle) is
 * responsible for persisting the result via createCheckpoint().
 */
export function generateRetro(data: RetroData): string {
  const { cycle, completed, carried_over, summary } = data;

  const period = `${cycle.started_at} → ${cycle.closed_at ?? 'in progress'}`;

  const completedSection =
    completed.length === 0
      ? '_None_'
      : completed.map((i) => `- ✓ ${i.slug}: ${i.title}`).join('\n');

  const carriedSection =
    carried_over.length === 0
      ? '_None_'
      : carried_over.map((i) => `- → ${i.slug}: ${i.title} (step: ${i.step})`).join('\n');

  return [
    `# Retro: ${cycle.title}`,
    '',
    `**Period:** ${period}`,
    '',
    '## Summary',
    '',
    summary,
    '',
    `## Completed (${completed.length})`,
    '',
    completedSection,
    '',
    `## Carried Over (${carried_over.length})`,
    '',
    carriedSection,
  ].join('\n');
}
