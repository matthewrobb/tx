// src/types/issue.ts — Issue domain types for twisted-workflow v4.
//
// v3 called these "epics" — v4 uses the more general term "Issue".
// An Issue has a workflow (step sequence), a status, and optional hierarchy
// via parent_id (parent is done when all children are done).

/**
 * Recursive JSON value type — avoids `any` while allowing arbitrary
 * serializable data in metadata and expression results.
 *
 * NOTE: We intentionally exclude `undefined` because JSON.parse never
 * produces it — this keeps the type honest about what can be persisted.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/**
 * Branded string for issue identifiers.
 *
 * Branding prevents accidental assignment of a plain string where an
 * IssueId is expected. Create via a factory or assertion at the boundary.
 */
export type IssueId = string & { readonly _brand: 'IssueId' };

/** Determines which default workflow is assigned to the issue. */
export type IssueType = 'feature' | 'bug' | 'spike' | 'chore' | 'release';

/**
 * Lifecycle status of an issue.
 *
 * - open: in progress or waiting for work
 * - blocked: cannot advance (external dependency, missing input)
 * - done: all steps complete
 * - archived: removed from active views
 */
export type IssueStatus = 'open' | 'blocked' | 'done' | 'archived';

export interface Issue {
  readonly id: IssueId;

  /** Human-readable identifier used in CLI commands (e.g. "my-feature"). */
  slug: string;

  title: string;

  /** Optional markdown description — null when not provided. */
  body: string | null;

  type: IssueType;

  /** References Workflow.id — determines which step sequence this issue follows. */
  workflow_id: string;

  /** Current step name within the workflow (e.g. "research", "build"). */
  step: string;

  status: IssueStatus;

  /**
   * Parent/child hierarchy: a parent issue is considered done when all its
   * children are done. null for top-level issues.
   */
  parent_id: IssueId | null;

  /**
   * Extensible key-value store for user/plugin data.
   *
   * Uses Json values so everything round-trips through JSON serialization.
   * Indexed access returns `Json | undefined` due to noUncheckedIndexedAccess.
   */
  metadata: Record<string, Json>;

  /** ISO 8601 timestamp. */
  created_at: string;

  /** ISO 8601 timestamp — updated on every state mutation. */
  updated_at: string;
}
