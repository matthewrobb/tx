// src/types/cycle.ts — Cycle (sprint/timebox) types for twisted-workflow v4.
//
// Cycles group issues into timeboxes. An issue can belong to multiple cycles
// (e.g. carried over from a previous sprint). The CycleIssue join tracks
// when each issue was pulled in and when it completed within that cycle.

import type { IssueId } from './issue.js';

/** Branded string for cycle identifiers. */
export type CycleId = string & { readonly _brand: 'CycleId' };

export type CycleStatus = 'active' | 'closed';

export interface Cycle {
  readonly id: CycleId;
  slug: string;
  title: string;
  description: string | null;
  status: CycleStatus;

  /** ISO 8601 timestamp. */
  started_at: string;

  /** ISO 8601 timestamp — null while the cycle is active. */
  closed_at: string | null;
}

/**
 * Association between a cycle and an issue.
 *
 * This is a join record — one per (cycle, issue) pair. An issue can appear
 * in multiple cycles if it carries over.
 */
export interface CycleIssue {
  cycle_id: CycleId;
  issue_id: IssueId;

  /** ISO 8601 — when the issue was added to this cycle. */
  pulled_at: string;

  /** ISO 8601 — null until the issue completes within this cycle. */
  completed_at: string | null;
}
