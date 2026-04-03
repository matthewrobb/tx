import type { Checkpoint } from './crud.js';
/**
 * Generate the markdown string for a checkpoint. Pure — no I/O.
 *
 * Format chosen to be human-readable and git-diffable. The `## Detail`
 * section preserves the full agent-written content block verbatim.
 */
export declare function renderCheckpointMarkdown(checkpoint: Checkpoint): string;
/**
 * Write a checkpoint to `{basePath}/checkpoints/{number}-{slug}.md`.
 *
 * Creates the checkpoints directory if it does not exist (idempotent via
 * recursive mkdir). Overwrites an existing file with the same name so a
 * re-projected checkpoint always reflects the current DB state.
 */
export declare function writeCheckpointFile(checkpoint: Checkpoint, basePath: string): Promise<void>;
//# sourceMappingURL=projection.d.ts.map