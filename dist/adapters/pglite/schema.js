// src/adapters/pglite/schema.ts — DDL for all domain tables.
//
// All primary keys are TEXT (UUIDs generated at the app layer).
// This avoids the uuid-ossp extension which is not available in PGLite WASM.
//
// Timestamps are stored as ISO 8601 TEXT strings rather than TIMESTAMPTZ.
// PGLite WASM does not expose a timezone-aware clock, and TEXT round-trips
// perfectly with JavaScript's Date.toISOString() without loss of precision.
//
// JSONB columns use DEFAULT '{}' where applicable so callers never receive
// a null for metadata — an empty object is the safe zero value.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS issues (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  step        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  parent_id   TEXT REFERENCES issues(id),
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cycles (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  started_at  TEXT NOT NULL,
  closed_at   TEXT
);

CREATE TABLE IF NOT EXISTS cycle_issues (
  cycle_id     TEXT NOT NULL REFERENCES cycles(id),
  issue_id     TEXT NOT NULL REFERENCES issues(id),
  pulled_at    TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (cycle_id, issue_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  summary    TEXT NOT NULL,
  tag        TEXT NOT NULL,
  issue_slug TEXT,
  cycle_slug TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id         TEXT PRIMARY KEY,
  number     INTEGER NOT NULL,
  issue_slug TEXT,
  summary    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vars (
  issue_slug TEXT NOT NULL,
  step       TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  PRIMARY KEY (issue_slug, step, key)
);

CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  issue_slug TEXT NOT NULL,
  summary    TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`;
//# sourceMappingURL=schema.js.map