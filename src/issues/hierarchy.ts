// src/issues/hierarchy.ts — Parent/child hierarchy helpers.
//
// A parent issue is considered done when all of its direct children are
// in a terminal state (done or archived). `propagateDone` is recursive:
// closing a child may close its parent, which may close its grandparent, etc.
//
// Circular parent chains are not possible given the DB foreign-key structure
// (a parent must exist before its children are inserted), so no cycle guard
// is needed.

import type { StoragePort, StorageTx } from '../ports/storage.js';
import type { Issue, IssueId } from '../types/issue.js';
import { listIssues, updateIssue } from './crud.js';

/** Get all direct children of a parent issue. */
export async function getChildren(
  db: StoragePort,
  parent_id: IssueId,
  tx?: StorageTx,
): Promise<Issue[]> {
  return listIssues(db, { parent_id }, tx);
}

/**
 * Check whether a parent issue should be auto-closed.
 *
 * Returns true when the parent has at least one child AND every child is in
 * a terminal state (done or archived). A parent with no children is not
 * auto-closed — it must be closed explicitly.
 */
export async function shouldAutoClose(
  db: StoragePort,
  parent_id: IssueId,
  tx?: StorageTx,
): Promise<boolean> {
  const children = await getChildren(db, parent_id, tx);
  if (children.length === 0) {
    return false;
  }
  return children.every(
    (child) => child.status === 'done' || child.status === 'archived',
  );
}

/**
 * After closing a child, check the parent and close it if all children are done.
 * Recurses upward: closing a parent may trigger its grandparent, etc.
 *
 * No-ops when the child has no parent_id (top-level issue).
 */
export async function propagateDone(
  db: StoragePort,
  child: Issue,
  tx?: StorageTx,
): Promise<void> {
  if (child.parent_id === null) {
    return;
  }

  const autoClose = await shouldAutoClose(db, child.parent_id, tx);
  if (!autoClose) {
    return;
  }

  // Close the parent, then recurse upward.
  const now = new Date().toISOString();
  // updateIssue sets updated_at internally; we just need to set status.
  const closedParent = await updateIssue(
    db,
    child.parent_id,
    { status: 'done' },
    tx,
  );

  // Suppress the unused variable warning — now is kept for documentation
  // intent but the actual timestamp is controlled by updateIssue.
  void now;

  await propagateDone(db, closedParent, tx);
}
