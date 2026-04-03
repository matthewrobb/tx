import type { StoragePort, StorageTx } from '../ports/storage.js';
import type { Issue, IssueId, IssueType, IssueStatus, Json } from '../types/issue.js';
export interface CreateIssueInput {
    slug: string;
    title: string;
    body?: string;
    type: IssueType;
    /** Caller provides; use DEFAULT_CONFIG to find the default for the type. */
    workflow_id: string;
    parent_id?: IssueId;
    metadata?: Record<string, Json>;
}
export interface ListIssuesOptions {
    status?: IssueStatus;
    type?: IssueType;
    /** null = top-level issues only (parent_id IS NULL). */
    parent_id?: IssueId | null;
    workflow_id?: string;
}
/** Fields that may be patched via updateIssue. updated_at is always set. */
export type IssueUpdate = Partial<Pick<Issue, 'title' | 'body' | 'step' | 'status' | 'metadata' | 'workflow_id'>>;
/**
 * Create a new issue.
 *
 * Initial step is the first step of the workflow (the step with no `needs`).
 * Initial status is 'open'.
 */
export declare function createIssue(db: StoragePort, input: CreateIssueInput, tx?: StorageTx): Promise<Issue>;
/** Get issue by ID. Returns null when not found. */
export declare function getIssue(db: StoragePort, id: IssueId, tx?: StorageTx): Promise<Issue | null>;
/** Get issue by slug. Returns null when not found. */
export declare function getIssueBySlug(db: StoragePort, slug: string, tx?: StorageTx): Promise<Issue | null>;
/**
 * List issues with optional filters.
 *
 * Filters are applied as AND conditions. Passing `parent_id: null` filters
 * to top-level issues (parent_id IS NULL). Omitting `parent_id` returns all.
 */
export declare function listIssues(db: StoragePort, opts?: ListIssuesOptions, tx?: StorageTx): Promise<Issue[]>;
/**
 * Update issue fields. Only provided fields are changed; updated_at is always set.
 * Throws when the issue does not exist.
 */
export declare function updateIssue(db: StoragePort, id: IssueId, update: IssueUpdate, tx?: StorageTx): Promise<Issue>;
/**
 * Close an issue: set status to 'done'.
 * After closing, checks whether the parent should also be auto-closed.
 * Throws when the issue with the given slug does not exist.
 */
export declare function closeIssue(db: StoragePort, slug: string, tx?: StorageTx): Promise<Issue>;
/**
 * Archive an issue: set status to 'archived'.
 * Throws when the issue with the given slug does not exist.
 */
export declare function archiveIssue(db: StoragePort, slug: string, tx?: StorageTx): Promise<Issue>;
//# sourceMappingURL=crud.d.ts.map