// src/issues/deferrals.ts — Issue deferral with traceability metadata.
//
// When a step is deferred, a sibling issue is created to own that work.
// Both issues get linked notes so the audit trail is bidirectional.
// All mutations run in a single transaction — either everything lands or nothing does.

import { randomUUID } from 'node:crypto';

import type { StoragePort, StorageTx } from '../ports/storage.js';
import type { Issue, IssueType, Json } from '../types/issue.js';
import { createIssue, getIssueBySlug, updateIssue } from './crud.js';

// ── Public types ───────────────────────────────────────────────────────────

export interface DeferStepInput {
  /** The issue whose step is being deferred. */
  source_slug: string;
  /** The step being deferred. */
  step: string;
  /** Human-readable reason for the deferral. */
  reason: string;
  /** Optional: override the new issue's type (defaults to same as source). */
  new_type?: IssueType;
  /** Optional: override the new issue's title (defaults to generated). */
  new_title?: string;
}

export interface DeferralResult {
  /** The updated source issue (metadata updated with deferral record). */
  source: Issue;
  /** The newly created sibling issue that owns the deferred work. */
  deferred: Issue;
}

// ── Internal note row shape ────────────────────────────────────────────────

interface NoteRow {
  id: string;
  summary: string;
  tag: string;
  issue_slug: string | null;
  cycle_slug: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Produce a URL-safe slug component from a string by lowercasing, replacing
 * non-alphanumeric characters with hyphens, collapsing runs, and trimming.
 * Truncated to `maxLen` characters to keep slugs readable.
 */
function toSlugPart(value: string, maxLen = 30): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

/** Insert a single note row directly via db.query(). */
async function insertNote(
  db: StoragePort,
  opts: {
    summary: string;
    tag: string;
    issue_slug: string;
    now: string;
  },
  tx: StorageTx,
): Promise<void> {
  const id = randomUUID();
  await db.query<NoteRow>(
    `INSERT INTO notes (id, summary, tag, issue_slug, cycle_slug, created_at)
     VALUES ($1, $2, $3, $4, NULL, $5)`,
    [id, opts.summary, opts.tag, opts.issue_slug, opts.now],
    tx,
  );
}

// ── Core deferral logic ────────────────────────────────────────────────────

/**
 * Perform a step deferral inside a single transaction.
 * Separated so both the "caller provides tx" and "we create tx" paths share
 * the same implementation without nesting transactions.
 */
async function deferStepInTx(
  db: StoragePort,
  input: DeferStepInput,
  tx: StorageTx,
): Promise<DeferralResult> {
  const now = new Date().toISOString();

  // 1. Load source issue — throw if not found.
  const source = await getIssueBySlug(db, input.source_slug, tx);
  if (source === null) {
    throw new Error(`Issue not found: ${input.source_slug}`);
  }

  // 2. Build the deferred issue slug.
  //    Format: "{source_slug}-deferred-{step}-{timestamp-ms}"
  //    Timestamp uses epoch ms for uniqueness; step is slugified for safety.
  const timestampMs = Date.now().toString();
  const stepPart = toSlugPart(input.step);
  const sourcePart = toSlugPart(input.source_slug, 40);
  const deferredSlug = `${sourcePart}-deferred-${stepPart}-${timestampMs}`;

  const deferredTitle =
    input.new_title ?? `[Deferred] ${source.title} — ${input.step}`;

  // Metadata carried by the deferred issue records provenance.
  const deferredMetadata: Record<string, Json> = {
    deferred_from: {
      issue_slug: source.slug,
      issue_id: source.id,
      step: input.step,
      workflow_id: source.workflow_id,
      deferred_at: now,
    },
    reason: input.reason,
  };

  // 3. Create the deferred sibling issue.
  const deferred = await createIssue(
    db,
    {
      slug: deferredSlug,
      title: deferredTitle,
      type: input.new_type ?? source.type,
      workflow_id: source.workflow_id,
      metadata: deferredMetadata,
    },
    tx,
  );

  // 4. Add 'defer' note to source issue.
  await insertNote(
    db,
    {
      summary: `Deferred step '${input.step}' → ${deferred.slug}: ${input.reason}`,
      tag: 'defer',
      issue_slug: source.slug,
      now,
    },
    tx,
  );

  // 5. Add 'discover' note to deferred issue.
  await insertNote(
    db,
    {
      summary: `Created from ${source.slug} step '${input.step}' deferral`,
      tag: 'discover',
      issue_slug: deferred.slug,
      now,
    },
    tx,
  );

  // 6. Update source issue metadata with deferral record.
  //    Append to any existing deferrals array — preserves history across
  //    multiple deferrals on the same issue.
  const existingDeferrals = Array.isArray(source.metadata['deferrals'])
    ? (source.metadata['deferrals'] as Json[])
    : [];

  const updatedMetadata: Record<string, Json> = {
    ...source.metadata,
    deferrals: [
      ...existingDeferrals,
      { step: input.step, deferred_slug: deferred.slug, at: now },
    ],
  };

  const updatedSource = await updateIssue(
    db,
    source.id,
    { metadata: updatedMetadata },
    tx,
  );

  return { source: updatedSource, deferred };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Defer a step from one issue to a new sibling issue.
 *
 * Creates the sibling, links both issues with notes, and records the
 * deferral in the source issue's metadata — all within a single transaction.
 *
 * Design decision: throws on unknown source slug (rather than returning an
 * error result) because the caller always knows the slug in advance and a
 * missing slug is a programming error, not a recoverable condition.
 *
 * @param db    StoragePort instance
 * @param input Deferral parameters
 * @param tx    Optional transaction handle — when provided, all operations
 *              run within it and the caller is responsible for commit/rollback.
 *              When omitted, a new transaction is created automatically.
 */
export async function deferStep(
  db: StoragePort,
  input: DeferStepInput,
  tx?: StorageTx,
): Promise<DeferralResult> {
  if (tx !== undefined) {
    // Caller owns the transaction — run directly inside it.
    return deferStepInTx(db, input, tx);
  }
  // No transaction provided — wrap everything in one.
  return db.transaction((newTx) => deferStepInTx(db, input, newTx));
}
