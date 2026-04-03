// src/cycles/lifecycle.ts — startCycle(), pullIssues(), closeCycle().
//
// All mutations run through StoragePort. closeCycle() uses a single
// transaction to keep the close operation atomic: updating cycle_issues,
// creating the checkpoint, and flipping the cycle status all commit together
// or none of them do.

import { randomUUID } from 'node:crypto';

import type { StoragePort, StorageTx } from '../ports/storage.js';
import type { Cycle, CycleId, CycleIssue } from '../types/cycle.js';
import type { Issue, IssueId } from '../types/issue.js';
import { listIssues } from '../issues/crud.js';
import { createCheckpoint } from '../checkpoints/crud.js';
import { generateRetro } from './retro.js';

// ── Internal DB row shapes ─────────────────────────────────────────────────

interface CycleRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  started_at: string;
  closed_at: string | null;
}

interface CycleIssueRow {
  cycle_id: string;
  issue_id: string;
  pulled_at: string;
  completed_at: string | null;
}

// Join row used when querying cycle_issues together with issue data.
interface CycleIssueJoinRow extends CycleIssueRow {
  slug: string;
  title: string;
  body: string | null;
  type: string;
  workflow_id: string;
  step: string;
  issue_status: string;
  parent_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any; // JSONB arrives as a parsed JS object from PGLite
  created_at: string;
  updated_at: string;
}

function rowToCycle(row: CycleRow): Cycle {
  return {
    id: row.id as CycleId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    // Trust the DB — only valid CycleStatus values were ever written.
    status: row.status as Cycle['status'],
    started_at: row.started_at,
    closed_at: row.closed_at,
  };
}

function joinRowToIssue(row: CycleIssueJoinRow): Issue {
  return {
    id: row.issue_id as IssueId,
    slug: row.slug,
    title: row.title,
    body: row.body,
    type: row.type as Issue['type'],
    workflow_id: row.workflow_id,
    step: row.step,
    status: row.issue_status as Issue['status'],
    parent_id: row.parent_id !== null ? (row.parent_id as IssueId) : null,
    // JSONB columns arrive as parsed objects from PGLite.
    // We wrote them as Record<string, Json>, so the cast is safe.
    metadata: (row.metadata ?? {}) as Issue['metadata'],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Load a cycle by slug. Returns null when not found. */
async function getCycleBySlug(
  db: StoragePort,
  slug: string,
  tx?: StorageTx,
): Promise<Cycle | null> {
  const result = await db.query<CycleRow>(
    'SELECT * FROM cycles WHERE slug = $1',
    [slug],
    tx,
  );
  const row = result.rows[0];
  return row !== undefined ? rowToCycle(row) : null;
}

// ── Public types ───────────────────────────────────────────────────────────

export interface StartCycleInput {
  slug: string;
  title: string;
  description?: string;
}

export interface PullResult {
  cycle: Cycle;
  pulled: Issue[]; // newly pulled into the cycle
  skipped: Issue[]; // already in cycle or already done
}

export interface CloseCycleInput {
  cycleSlug: string;
  summary: string; // human-written retro summary from the agent
}

export interface CloseCycleResult {
  cycle: Cycle;
  retro: string; // markdown retro content
  checkpointId: string; // ID of the created checkpoint
  completed: number; // issues completed in this cycle
  carried_over: number; // issues still open at close
}

// ── startCycle ─────────────────────────────────────────────────────────────

/**
 * Start a new cycle.
 *
 * Enforces a single-active-cycle invariant: errors if any cycle with
 * status = 'active' already exists.
 */
export async function startCycle(
  db: StoragePort,
  input: StartCycleInput,
): Promise<Cycle> {
  // Guard: only one active cycle at a time.
  const activeCheck = await db.query<CycleRow>(
    "SELECT id FROM cycles WHERE status = 'active' LIMIT 1",
    [],
  );
  if ((activeCheck.rows[0]) !== undefined) {
    throw new Error('A cycle is already active. Close it before starting a new one.');
  }

  const id = randomUUID() as CycleId;
  const now = new Date().toISOString();

  const result = await db.query<CycleRow>(
    `INSERT INTO cycles (id, slug, title, description, status, started_at, closed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.slug,
      input.title,
      input.description ?? null,
      'active',
      now,
      null,
    ],
  );

  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('INSERT did not return a row');
  }
  return rowToCycle(row);
}

// ── pullIssues ─────────────────────────────────────────────────────────────

/**
 * Pull issues into an active cycle.
 *
 * When `issueSlugs` is empty, auto-pulls all open issues not already in the
 * cycle. Issues already in the cycle or with status 'done' go to `skipped`.
 */
export async function pullIssues(
  db: StoragePort,
  cycleSlug: string,
  issueSlugs: string[],
): Promise<PullResult> {
  const cycle = await getCycleBySlug(db, cycleSlug);
  if (cycle === null) {
    throw new Error(`Cycle not found: ${cycleSlug}`);
  }
  if (cycle.status !== 'active') {
    throw new Error(`Cycle '${cycleSlug}' is not active (status: ${cycle.status})`);
  }

  // Load the full set of issues already in this cycle.
  const existingRows = await db.query<Pick<CycleIssueRow, 'issue_id'>>(
    'SELECT issue_id FROM cycle_issues WHERE cycle_id = $1',
    [cycle.id],
  );
  const alreadyInCycle = new Set(existingRows.rows.map((r) => r.issue_id));

  // Determine candidate issues.
  let candidates: Issue[];
  if (issueSlugs.length === 0) {
    // Auto-pull: all open issues not already in this cycle.
    candidates = await listIssues(db, { status: 'open' });
  } else {
    // Explicit slugs: load each one by slug.
    const results = await Promise.all(
      issueSlugs.map((slug) =>
        db.query<{
          id: string;
          slug: string;
          title: string;
          body: string | null;
          type: string;
          workflow_id: string;
          step: string;
          status: string;
          parent_id: string | null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: any;
          created_at: string;
          updated_at: string;
        }>('SELECT * FROM issues WHERE slug = $1', [slug]),
      ),
    );
    candidates = results.flatMap((r) =>
      r.rows.map((row) => ({
        id: row.id as IssueId,
        slug: row.slug,
        title: row.title,
        body: row.body,
        type: row.type as Issue['type'],
        workflow_id: row.workflow_id,
        step: row.step,
        status: row.status as Issue['status'],
        parent_id: row.parent_id !== null ? (row.parent_id as IssueId) : null,
        metadata: (row.metadata ?? {}) as Issue['metadata'],
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    );

    // Error when a requested slug was not found in the DB.
    const foundSlugs = new Set(candidates.map((i) => i.slug));
    for (const slug of issueSlugs) {
      if (!foundSlugs.has(slug)) {
        throw new Error(`Issue not found: ${slug}`);
      }
    }
  }

  const pulled: Issue[] = [];
  const skipped: Issue[] = [];
  const now = new Date().toISOString();

  for (const issue of candidates) {
    // Skip if already in cycle or already done.
    if (alreadyInCycle.has(issue.id) || issue.status === 'done') {
      skipped.push(issue);
      continue;
    }

    await db.query(
      `INSERT INTO cycle_issues (cycle_id, issue_id, pulled_at, completed_at)
       VALUES ($1, $2, $3, $4)`,
      [cycle.id, issue.id, now, null],
    );
    pulled.push(issue);
  }

  return { cycle, pulled, skipped };
}

// ── closeCycle ─────────────────────────────────────────────────────────────

/**
 * Close an active cycle.
 *
 * All mutations run inside a single transaction:
 * 1. Load cycle and validate it's active.
 * 2. Load all cycle_issues with issue data via join.
 * 3. Mark completed issues (issue.status === 'done') with completed_at = now.
 * 4. Generate markdown retro via generateRetro().
 * 5. Create a checkpoint with the retro as content.
 * 6. Update cycle status to 'closed' and set closed_at.
 */
export async function closeCycle(
  db: StoragePort,
  input: CloseCycleInput,
): Promise<CloseCycleResult> {
  return db.transaction(async (tx) => {
    // 1. Load and validate cycle.
    const cycle = await getCycleBySlug(db, input.cycleSlug, tx);
    if (cycle === null) {
      throw new Error(`Cycle not found: ${input.cycleSlug}`);
    }
    if (cycle.status !== 'active') {
      throw new Error(
        `Cycle '${input.cycleSlug}' is not active (status: ${cycle.status})`,
      );
    }

    // 2. Load all cycle_issues joined with issue data.
    //    Alias issue.status as issue_status to avoid collision with the
    //    cycle_issues columns if they ever gain a status column.
    const joinResult = await db.query<CycleIssueJoinRow>(
      `SELECT
         ci.cycle_id,
         ci.issue_id,
         ci.pulled_at,
         ci.completed_at,
         i.slug,
         i.title,
         i.body,
         i.type,
         i.workflow_id,
         i.step,
         i.status AS issue_status,
         i.parent_id,
         i.metadata,
         i.created_at,
         i.updated_at
       FROM cycle_issues ci
       JOIN issues i ON i.id = ci.issue_id
       WHERE ci.cycle_id = $1`,
      [cycle.id],
      tx,
    );

    const joinRows = joinResult.rows;
    const now = new Date().toISOString();

    // 3. Mark completed issues with completed_at and split into buckets.
    const completedIssues: Issue[] = [];
    const carriedOverIssues: Issue[] = [];

    for (const row of joinRows) {
      const issue = joinRowToIssue(row);
      if (issue.status === 'done') {
        // Update completed_at on the join record.
        await db.query(
          `UPDATE cycle_issues
           SET completed_at = $1
           WHERE cycle_id = $2 AND issue_id = $3`,
          [now, cycle.id, issue.id],
          tx,
        );
        completedIssues.push(issue);
      } else {
        carriedOverIssues.push(issue);
      }
    }

    // 4. Generate retro markdown. closed_at is set to now for the period line.
    const closedCycle: Cycle = { ...cycle, closed_at: now };

    const retroMarkdown = generateRetro({
      cycle: closedCycle,
      completed: completedIssues,
      carried_over: carriedOverIssues,
      summary: input.summary,
    });

    // 5. Create checkpoint with retro as content.
    const checkpoint = await createCheckpoint(
      db,
      {
        summary: `Retro: ${cycle.title}`,
        content: retroMarkdown,
      },
      tx,
    );

    // 6. Update cycle to closed.
    const closeResult = await db.query<CycleRow>(
      `UPDATE cycles
       SET status = $1, closed_at = $2
       WHERE id = $3
       RETURNING *`,
      ['closed', now, cycle.id],
      tx,
    );
    const closedRow = closeResult.rows[0];
    if (closedRow === undefined) {
      throw new Error('UPDATE cycles did not return a row');
    }

    // The cycle_issues and checkpoint inserts used the tx handle, so they
    // are committed atomically with the cycle status update.
    void ({} as CycleIssue); // keep import used — CycleIssue is structural documentation

    return {
      cycle: rowToCycle(closedRow),
      retro: retroMarkdown,
      checkpointId: checkpoint.id,
      completed: completedIssues.length,
      carried_over: carriedOverIssues.length,
    };
  });
}
