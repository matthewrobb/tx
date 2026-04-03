// src/checkpoints/__tests__/crud.test.ts
//
// Tests for checkpoint CRUD and projection.
//
// S-003 (PGLite adapter) is being built in parallel on this branch. Rather
// than depend on the real adapter, we use a minimal in-memory StoragePort
// mock that only supports the SQL patterns used by checkpoints. This keeps
// the checkpoint tests independent of S-003's delivery schedule while still
// proving the behavior of our SQL queries.
//
// The mock uses a plain Map<string, CheckpointRow> and executes the exact
// SQL strings issued by crud.ts via a tiny hand-rolled parser. It is NOT a
// general SQL interpreter — it only handles the three statement shapes the
// checkpoints module actually emits.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCheckpoint,
  getCheckpoint,
  getLatestCheckpoint,
  listCheckpoints,
} from '../crud.js';
import { renderCheckpointMarkdown } from '../projection.js';
import type { StoragePort, StorageTx, QueryResults } from '../../ports/storage.js';

// ── In-memory StoragePort mock ─────────────────────────────────

interface StoredCheckpoint {
  id: string;
  number: number;
  issue_slug: string | null;
  summary: string;
  content: string;
  created_at: string;
}

/**
 * Build a minimal in-memory StoragePort that supports exactly the SQL
 * patterns issued by checkpoints/crud.ts. Any unrecognised SQL throws
 * so tests catch accidental query drift early.
 */
function makeStorage(): StoragePort {
  const rows: StoredCheckpoint[] = [];

  function runQuery<T>(sql: string, params: unknown[] = []): QueryResults<T> {
    const s = sql.trim().replace(/\s+/g, ' ');

    // SELECT MAX(number) AS max_num FROM checkpoints
    if (/^SELECT MAX\(number\) AS max_num FROM checkpoints$/.test(s)) {
      const maxNum = rows.length === 0 ? null : Math.max(...rows.map((r) => r.number));
      return { rows: [{ max_num: maxNum }] as T[], fields: [] };
    }

    // INSERT INTO checkpoints (id, number, issue_slug, summary, content, created_at) VALUES (...)
    if (/^INSERT INTO checkpoints/.test(s)) {
      const [id, number, issue_slug, summary, content, created_at] = params as [
        string,
        number,
        string | null,
        string,
        string,
        string,
      ];
      rows.push({ id, number, issue_slug, summary, content, created_at });
      return { rows: [] as T[], fields: [], affectedRows: 1 };
    }

    // SELECT ... FROM checkpoints WHERE id = $1
    if (/^SELECT .+ FROM checkpoints WHERE id = \$1$/.test(s)) {
      const [id] = params as [string];
      const found = rows.find((r) => r.id === id);
      return { rows: (found != null ? [found] : []) as T[], fields: [] };
    }

    // SELECT ... FROM checkpoints WHERE issue_slug = $1 ORDER BY number DESC LIMIT 1
    if (/^SELECT .+ FROM checkpoints WHERE issue_slug = \$1 ORDER BY number DESC LIMIT 1$/.test(s)) {
      const [slug] = params as [string];
      const filtered = rows.filter((r) => r.issue_slug === slug).sort((a, b) => b.number - a.number);
      return { rows: (filtered.length > 0 ? [filtered[0]!] : []) as T[], fields: [] };
    }

    // SELECT ... FROM checkpoints ORDER BY number DESC LIMIT 1
    if (/^SELECT .+ FROM checkpoints ORDER BY number DESC LIMIT 1$/.test(s)) {
      const sorted = [...rows].sort((a, b) => b.number - a.number);
      return { rows: (sorted.length > 0 ? [sorted[0]!] : []) as T[], fields: [] };
    }

    // SELECT ... FROM checkpoints WHERE issue_slug = $1 ORDER BY number DESC
    if (/^SELECT .+ FROM checkpoints WHERE issue_slug = \$1 ORDER BY number DESC$/.test(s)) {
      const [slug] = params as [string];
      const filtered = rows.filter((r) => r.issue_slug === slug).sort((a, b) => b.number - a.number);
      return { rows: filtered as T[], fields: [] };
    }

    // SELECT ... FROM checkpoints ORDER BY number DESC
    if (/^SELECT .+ FROM checkpoints ORDER BY number DESC$/.test(s)) {
      const sorted = [...rows].sort((a, b) => b.number - a.number);
      return { rows: sorted as T[], fields: [] };
    }

    throw new Error(`Unrecognised SQL in mock storage: ${s}`);
  }

  const storage: StoragePort = {
    async query<T>(sql: string, params?: unknown[], _tx?: StorageTx): Promise<QueryResults<T>> {
      return runQuery<T>(sql, params);
    },
    async exec(_sql: string, _tx?: StorageTx): Promise<Array<QueryResults<unknown>>> {
      throw new Error('exec() not implemented in checkpoint mock');
    },
    async transaction<T>(callback: (tx: StorageTx) => Promise<T>): Promise<T> {
      // Transactions are not used by checkpoint CRUD, but we provide a
      // minimal no-op handle in case future code paths pass one through.
      const tx: StorageTx = {
        async query<U>(sql: string, params?: unknown[]): Promise<QueryResults<U>> {
          return runQuery<U>(sql, params);
        },
        async exec(_sql: string): Promise<Array<QueryResults<unknown>>> {
          throw new Error('exec() not implemented in checkpoint mock tx');
        },
        async rollback(): Promise<void> {
          // no-op
        },
        closed: false,
      };
      return callback(tx);
    },
  };

  return storage;
}

// ── Tests ──────────────────────────────────────────────────────

describe('createCheckpoint', () => {
  let db: StoragePort;
  beforeEach(() => {
    db = makeStorage();
  });

  it('creates a checkpoint with number 1 when none exist', async () => {
    const cp = await createCheckpoint(db, {
      summary: 'First session done',
      content: 'Implemented the storage port.',
    });

    expect(cp.number).toBe(1);
    expect(cp.summary).toBe('First session done');
    expect(cp.content).toBe('Implemented the storage port.');
    expect(cp.issue_slug).toBeNull();
    // UUID format
    expect(cp.id).toMatch(/^[0-9a-f-]{36}$/);
    // ISO 8601
    expect(cp.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('assigns sequential numbers across multiple checkpoints', async () => {
    const first = await createCheckpoint(db, { summary: 'One', content: 'Content one' });
    const second = await createCheckpoint(db, { summary: 'Two', content: 'Content two' });

    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
  });

  it('stores issue_slug when provided', async () => {
    const cp = await createCheckpoint(db, {
      issue_slug: 'feat-login',
      summary: 'Auth work',
      content: 'Wrote login handler.',
    });

    expect(cp.issue_slug).toBe('feat-login');
  });
});

describe('getCheckpoint', () => {
  let db: StoragePort;
  beforeEach(() => {
    db = makeStorage();
  });

  it('retrieves a checkpoint by ID', async () => {
    const created = await createCheckpoint(db, { summary: 'Summary', content: 'Detail' });
    const found = await getCheckpoint(db, created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.summary).toBe('Summary');
  });

  it('returns null for an unknown ID', async () => {
    const result = await getCheckpoint(db, 'does-not-exist');
    expect(result).toBeNull();
  });
});

describe('getLatestCheckpoint', () => {
  let db: StoragePort;
  beforeEach(() => {
    db = makeStorage();
  });

  it('returns the highest-numbered checkpoint globally', async () => {
    await createCheckpoint(db, { summary: 'First', content: 'A' });
    await createCheckpoint(db, { summary: 'Second', content: 'B' });
    const third = await createCheckpoint(db, { summary: 'Third', content: 'C' });

    const latest = await getLatestCheckpoint(db);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(third.id);
    expect(latest!.number).toBe(3);
  });

  it('returns null when no checkpoints exist', async () => {
    const result = await getLatestCheckpoint(db);
    expect(result).toBeNull();
  });

  it('filters by issue_slug when provided', async () => {
    await createCheckpoint(db, { summary: 'Global one', content: 'A' });
    const issueFirst = await createCheckpoint(db, {
      issue_slug: 'feat-auth',
      summary: 'Issue first',
      content: 'B',
    });
    await createCheckpoint(db, { summary: 'Global two', content: 'C' });
    const issueSecond = await createCheckpoint(db, {
      issue_slug: 'feat-auth',
      summary: 'Issue second',
      content: 'D',
    });

    const latest = await getLatestCheckpoint(db, 'feat-auth');
    expect(latest!.id).toBe(issueSecond.id);
    // The unfiltered latest would be number 4 (issueSecond), but if we search
    // for a different slug it should return null.
    const unrelated = await getLatestCheckpoint(db, 'feat-payments');
    expect(unrelated).toBeNull();

    void issueFirst; // suppress unused-variable lint in strict mode
  });
});

describe('listCheckpoints', () => {
  let db: StoragePort;
  beforeEach(() => {
    db = makeStorage();
  });

  it('returns all checkpoints ordered by number DESC', async () => {
    await createCheckpoint(db, { summary: 'One', content: 'A' });
    await createCheckpoint(db, { summary: 'Two', content: 'B' });
    await createCheckpoint(db, { summary: 'Three', content: 'C' });

    const list = await listCheckpoints(db);
    expect(list).toHaveLength(3);
    // Descending order
    expect(list[0]!.number).toBe(3);
    expect(list[1]!.number).toBe(2);
    expect(list[2]!.number).toBe(1);
  });

  it('returns empty array when no checkpoints exist', async () => {
    const list = await listCheckpoints(db);
    expect(list).toEqual([]);
  });

  it('filters by issue_slug when provided', async () => {
    await createCheckpoint(db, { summary: 'Global', content: 'A' });
    await createCheckpoint(db, { issue_slug: 'feat-auth', summary: 'Auth one', content: 'B' });
    await createCheckpoint(db, { issue_slug: 'feat-auth', summary: 'Auth two', content: 'C' });

    const list = await listCheckpoints(db, 'feat-auth');
    expect(list).toHaveLength(2);
    expect(list.every((c) => c.issue_slug === 'feat-auth')).toBe(true);
    // Still ordered DESC
    expect(list[0]!.summary).toBe('Auth two');
  });
});

describe('renderCheckpointMarkdown', () => {
  it('contains the summary and content', () => {
    const checkpoint = {
      id: 'abcdef12-0000-0000-0000-000000000000',
      number: 3,
      issue_slug: 'feat-v4',
      summary: 'Finished storage port',
      content: 'Wrote StoragePort interface and PGLite adapter.',
      created_at: '2026-04-02T10:00:00.000Z',
    };

    const md = renderCheckpointMarkdown(checkpoint);

    expect(md).toContain('# Checkpoint #3');
    expect(md).toContain('Finished storage port');
    expect(md).toContain('Wrote StoragePort interface and PGLite adapter.');
    expect(md).toContain('**Issue:** feat-v4');
    expect(md).toContain('**Created:** 2026-04-02T10:00:00.000Z');
  });

  it('renders "none" when issue_slug is null', () => {
    const checkpoint = {
      id: 'abcdef12-0000-0000-0000-000000000001',
      number: 1,
      issue_slug: null,
      summary: 'Session done',
      content: 'Global checkpoint.',
      created_at: '2026-04-02T09:00:00.000Z',
    };

    const md = renderCheckpointMarkdown(checkpoint);
    expect(md).toContain('**Issue:** none');
  });
});
