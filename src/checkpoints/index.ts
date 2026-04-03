// src/checkpoints/index.ts — barrel export for the checkpoints module.

export type { Checkpoint, CreateCheckpointInput } from './crud.js';
export {
  createCheckpoint,
  getCheckpoint,
  getLatestCheckpoint,
  listCheckpoints,
} from './crud.js';

export {
  renderCheckpointMarkdown,
  writeCheckpointFile,
} from './projection.js';
