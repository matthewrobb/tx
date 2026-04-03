// src/migration/index.ts — barrel export for workflow migration module.

export type {
  MigrationRule,
  MigrationPlan,
  ValidationResult,
} from './rules.js';

export { validateMigrationPlan } from './rules.js';

export type {
  MigrationResult,
  MigrationPreviewEntry,
} from './runner.js';

export { applyMigration, previewMigration } from './runner.js';
