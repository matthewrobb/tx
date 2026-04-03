// src/adapters/pglite/__tests__/adapter.test.ts
//
// Behavioral tests for PGLiteStorageAdapter and the JSONB builders.
// All tests use createInMemoryStorageAdapter() — no file I/O.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../adapter.js';
import { jsonbGet, jsonbSet, jsonbContains } from '../builders.js';
import type { PGLiteStorageAdapter } from '../adapter.js';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Create a minimal notes row for use in INSERT tests. */
function makeNote(id: string, summary: string) {
  return {
    id,
    summary,
    tag: 'discover',
    created_at: new Date().toISOString(),
  };
}

// ── Schema creation ───────────────────────────────────────────────────────

describe('schema creation', () => {
  it('all domain tables exist after createInMemoryStorageAdapter()', async () => {
    const adapter = await createInMemoryStorageAdapter();

    const result = await adapter.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );

    const tables = result.rows.map((r) => r.tablename).sort();
    expect(tables).toEqual(
      expect.arrayContaining([
        'checkpoints',
        'cycle_issues',
        'cycles',
        'issues',
        'notes',
        'tasks',
        'vars',
      ]),
    );
  });

  it('_migrations tracking table exists and has one row after init', async () => {
    const adapter = await createInMemoryStorageAdapter();

    const result = await adapter.query<{ id: number }>(
      'SELECT id FROM _migrations ORDER BY id',
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe(1);
  });
});

// ── Basic query ───────────────────────────────────────────────────────────

describe('basic query', () => {
  let adapter: PGLiteStorageAdapter;

  beforeEach(async () => {
    adapter = await createInMemoryStorageAdapter();
  });

  it('INSERT then SELECT roundtrip returns the row', async () => {
    const note = makeNote('note-1', 'first note');

    await adapter.query(
      `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
      [note.id, note.summary, note.tag, note.created_at],
    );

    const result = await adapter.query<{ id: string; summary: string }>(
      `SELECT id, summary FROM notes WHERE id = $1`,
      [note.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: 'note-1', summary: 'first note' });
  });

  it('affectedRows is 1 after a single INSERT', async () => {
    const note = makeNote('note-2', 'second note');

    const result = await adapter.query(
      `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
      [note.id, note.summary, note.tag, note.created_at],
    );

    expect(result.affectedRows).toBe(1);
  });
});

// ── Parameterized query ───────────────────────────────────────────────────

describe('parameterized query', () => {
  it('$1 placeholder is bound correctly and prevents SQL injection', async () => {
    const adapter = await createInMemoryStorageAdapter();
    const maliciousSlug = `'; DROP TABLE notes; --`;

    const note = makeNote('note-param', 'parameterized note');
    await adapter.query(
      `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
      [note.id, note.summary, note.tag, note.created_at],
    );

    // Querying with a param that would be dangerous as string interpolation
    // should return zero rows, not throw or drop the table.
    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [maliciousSlug],
    );

    expect(result.rows).toHaveLength(0);

    // Table is still alive.
    const check = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [note.id],
    );
    expect(check.rows).toHaveLength(1);
  });

  it('multiple parameters bind to the correct placeholders', async () => {
    const adapter = await createInMemoryStorageAdapter();

    await adapter.query(
      `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
      ['n1', 'alpha', 'decide', new Date().toISOString()],
    );
    await adapter.query(
      `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
      ['n2', 'beta', 'discover', new Date().toISOString()],
    );

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE tag = $1 AND summary = $2`,
      ['decide', 'alpha'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe('n1');
  });
});

// ── Transaction commit ────────────────────────────────────────────────────

describe('transaction commit', () => {
  it('changes are visible after the transaction resolves', async () => {
    const adapter = await createInMemoryStorageAdapter();
    const note = makeNote('note-tx-commit', 'committed note');

    await adapter.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
        [note.id, note.summary, note.tag, note.created_at],
      );
    });

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [note.id],
    );

    expect(result.rows).toHaveLength(1);
  });
});

// ── Transaction rollback (explicit) ──────────────────────────────────────

describe('transaction rollback — explicit', () => {
  it('changes are NOT visible after tx.rollback() is called', async () => {
    const adapter = await createInMemoryStorageAdapter();
    const note = makeNote('note-tx-rollback', 'rolled-back note');

    await adapter.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
        [note.id, note.summary, note.tag, note.created_at],
      );
      await tx.rollback();
    });

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [note.id],
    );

    expect(result.rows).toHaveLength(0);
  });
});

// ── Transaction auto-rollback (callback rejects) ──────────────────────────

describe('transaction auto-rollback — callback rejects', () => {
  it('changes are NOT visible when callback throws', async () => {
    const adapter = await createInMemoryStorageAdapter();
    const note = makeNote('note-auto-rollback', 'auto-rolled-back note');

    await expect(
      adapter.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
          [note.id, note.summary, note.tag, note.created_at],
        );
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [note.id],
    );

    expect(result.rows).toHaveLength(0);
  });
});

// ── Composable transactions ───────────────────────────────────────────────

describe('composable transactions', () => {
  it('nested query() calls with the tx handle participate in the same transaction', async () => {
    const adapter = await createInMemoryStorageAdapter();

    const note1 = makeNote('note-comp-1', 'composable note 1');
    const note2 = makeNote('note-comp-2', 'composable note 2');

    // Both inserts use the tx handle — they should both commit together.
    await adapter.transaction(async (tx) => {
      // Thread tx down to adapter.query via the optional third argument.
      await adapter.query(
        `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
        [note1.id, note1.summary, note1.tag, note1.created_at],
        tx,
      );
      await adapter.query(
        `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
        [note2.id, note2.summary, note2.tag, note2.created_at],
        tx,
      );
    });

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id IN ($1, $2) ORDER BY id`,
      [note1.id, note2.id],
    );

    expect(result.rows).toHaveLength(2);
  });

  it('nested query() with tx is rolled back when callback throws', async () => {
    const adapter = await createInMemoryStorageAdapter();
    const note = makeNote('note-comp-rollback', 'should not persist');

    await expect(
      adapter.transaction(async (tx) => {
        await adapter.query(
          `INSERT INTO notes (id, summary, tag, created_at) VALUES ($1, $2, $3, $4)`,
          [note.id, note.summary, note.tag, note.created_at],
          tx,
        );
        throw new Error('nested rollback');
      }),
    ).rejects.toThrow('nested rollback');

    const result = await adapter.query<{ id: string }>(
      `SELECT id FROM notes WHERE id = $1`,
      [note.id],
    );

    expect(result.rows).toHaveLength(0);
  });
});

// ── JSONB builders ────────────────────────────────────────────────────────

describe('JSONB builders', () => {
  describe('jsonbGet', () => {
    it('produces the correct ->> SQL expression', () => {
      const sql = jsonbGet('metadata', 'priority');
      expect(sql).toBe(`"metadata"->>'priority'`);
    });

    it('can be used in a WHERE clause to filter by JSONB key', async () => {
      const adapter = await createInMemoryStorageAdapter();

      // Insert an issue with metadata containing a priority key.
      const now = new Date().toISOString();
      await adapter.query(
        `INSERT INTO issues
           (id, slug, title, type, workflow_id, step, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          'issue-jsonb-1',
          'feat-a',
          'Feature A',
          'feature',
          'default',
          'research',
          'open',
          JSON.stringify({ priority: 'high' }),
          now,
          now,
        ],
      );
      await adapter.query(
        `INSERT INTO issues
           (id, slug, title, type, workflow_id, step, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          'issue-jsonb-2',
          'feat-b',
          'Feature B',
          'feature',
          'default',
          'research',
          'open',
          JSON.stringify({ priority: 'low' }),
          now,
          now,
        ],
      );

      const getSql = jsonbGet('metadata', 'priority');
      const result = await adapter.query<{ id: string }>(
        `SELECT id FROM issues WHERE ${getSql} = $1`,
        ['high'],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.id).toBe('issue-jsonb-1');
    });
  });

  describe('jsonbContains', () => {
    it('produces the correct @> SQL expression', () => {
      const { sql, params } = jsonbContains('metadata', { status: 'open' });
      expect(sql).toBe(`"metadata" @> $1::jsonb`);
      expect(params).toEqual(['{"status":"open"}']);
    });

    it('can be used in a WHERE clause to filter by JSONB containment', async () => {
      const adapter = await createInMemoryStorageAdapter();

      const now = new Date().toISOString();
      await adapter.query(
        `INSERT INTO issues
           (id, slug, title, type, workflow_id, step, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          'issue-contains-1',
          'feat-c',
          'Feature C',
          'feature',
          'default',
          'research',
          'open',
          JSON.stringify({ team: 'alpha', priority: 'high' }),
          now,
          now,
        ],
      );
      await adapter.query(
        `INSERT INTO issues
           (id, slug, title, type, workflow_id, step, status, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          'issue-contains-2',
          'feat-d',
          'Feature D',
          'feature',
          'default',
          'research',
          'open',
          JSON.stringify({ team: 'beta', priority: 'high' }),
          now,
          now,
        ],
      );

      const { sql, params } = jsonbContains('metadata', { team: 'alpha' });
      const result = await adapter.query<{ id: string }>(
        `SELECT id FROM issues WHERE ${sql}`,
        params,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.id).toBe('issue-contains-1');
    });
  });

  describe('jsonbSet', () => {
    it('produces the correct jsonb_set SQL expression', () => {
      const { sql, params } = jsonbSet('metadata', 'priority', 'critical');
      expect(sql).toBe(`jsonb_set("metadata", '{priority}', $1::jsonb)`);
      expect(params).toEqual(['"critical"']);
    });

    it('serializes non-string values correctly', () => {
      const { params: numParams } = jsonbSet('metadata', 'count', 42);
      expect(numParams).toEqual(['42']);

      const { params: objParams } = jsonbSet('metadata', 'tags', ['a', 'b']);
      expect(objParams).toEqual(['["a","b"]']);
    });
  });
});
