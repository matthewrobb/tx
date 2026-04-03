// src/adapters/pglite/index.ts — barrel export for the PGLite storage adapter.

export {
  PGLiteStorageAdapter,
  createStorageAdapter,
  createInMemoryStorageAdapter,
} from './adapter.js';

export { runMigrations } from './migrations.js';

export { jsonbGet, jsonbSet, jsonbContains } from './builders.js';
