import type { StoragePort, StorageTx } from '../ports/storage.js';
import type { Issue, IssueId } from '../types/issue.js';
/** Get all direct children of a parent issue. */
export declare function getChildren(db: StoragePort, parent_id: IssueId, tx?: StorageTx): Promise<Issue[]>;
/**
 * Check whether a parent issue should be auto-closed.
 *
 * Returns true when the parent has at least one child AND every child is in
 * a terminal state (done or archived). A parent with no children is not
 * auto-closed — it must be closed explicitly.
 */
export declare function shouldAutoClose(db: StoragePort, parent_id: IssueId, tx?: StorageTx): Promise<boolean>;
/**
 * After closing a child, check the parent and close it if all children are done.
 * Recurses upward: closing a parent may trigger its grandparent, etc.
 *
 * No-ops when the child has no parent_id (top-level issue).
 */
export declare function propagateDone(db: StoragePort, child: Issue, tx?: StorageTx): Promise<void>;
//# sourceMappingURL=hierarchy.d.ts.map