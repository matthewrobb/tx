// src/checkpoints/projection.ts — Render checkpoints to filesystem markdown.
//
// This module provides two levels of projection:
//   1. renderCheckpointMarkdown() — pure function, no I/O, produces a string.
//      Called by the ProjectionPort adapter's renderCheckpoint() after it
//      queries the DB for the Checkpoint record.
//   2. writeCheckpointFile() — writes the markdown string to disk under
//      {basePath}/checkpoints/{number}-{slug}.md
//
// The slug in the filename is the first 8 chars of the UUID. This is
// enough to disambiguate within a project and keeps filenames readable.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Checkpoint } from './crud.js';

// ── Pure rendering ─────────────────────────────────────────────

/**
 * Generate the markdown string for a checkpoint. Pure — no I/O.
 *
 * Format chosen to be human-readable and git-diffable. The `## Detail`
 * section preserves the full agent-written content block verbatim.
 */
export function renderCheckpointMarkdown(checkpoint: Checkpoint): string {
  const issueLine = checkpoint.issue_slug ?? 'none';

  return [
    `# Checkpoint #${checkpoint.number}`,
    '',
    `**Created:** ${checkpoint.created_at}`,
    `**Issue:** ${issueLine}`,
    '',
    '## Summary',
    '',
    checkpoint.summary,
    '',
    '## Detail',
    '',
    checkpoint.content,
  ].join('\n');
}

// ── Filesystem write ───────────────────────────────────────────

/**
 * Write a checkpoint to `{basePath}/checkpoints/{number}-{slug}.md`.
 *
 * Creates the checkpoints directory if it does not exist (idempotent via
 * recursive mkdir). Overwrites an existing file with the same name so a
 * re-projected checkpoint always reflects the current DB state.
 */
export async function writeCheckpointFile(
  checkpoint: Checkpoint,
  basePath: string,
): Promise<void> {
  // First 8 chars of UUID give enough uniqueness within a project.
  const slug = checkpoint.id.slice(0, 8);
  const filename = `${checkpoint.number}-${slug}.md`;
  const dir = join(basePath, 'checkpoints');

  // mkdir with recursive: true is idempotent — no error if dir already exists.
  await mkdir(dir, { recursive: true });

  const markdown = renderCheckpointMarkdown(checkpoint);
  await writeFile(join(dir, filename), markdown, 'utf8');
}
