import type { StoragePort, StorageTx } from '../ports/storage.js';
export interface Checkpoint {
    id: string;
    number: number;
    issue_slug: string | null;
    summary: string;
    content: string;
    created_at: string;
}
export interface CreateCheckpointInput {
    issue_slug?: string;
    summary: string;
    content: string;
}
/**
 * Create a new checkpoint. Auto-assigns the next sequential number by
 * selecting MAX(number) + 1. This is safe under PGLite's single-connection
 * serialized mutex — there is no concurrent writer race.
 */
export declare function createCheckpoint(db: StoragePort, input: CreateCheckpointInput, tx?: StorageTx): Promise<Checkpoint>;
/**
 * Get a checkpoint by its UUID. Returns null when the ID is not found
 * rather than throwing — callers that require existence should check the
 * return value explicitly.
 */
export declare function getCheckpoint(db: StoragePort, id: string, tx?: StorageTx): Promise<Checkpoint | null>;
/**
 * Get the most recent checkpoint (highest number), optionally filtered to
 * a specific issue. Returns null when no checkpoints exist.
 */
export declare function getLatestCheckpoint(db: StoragePort, issue_slug?: string, tx?: StorageTx): Promise<Checkpoint | null>;
/**
 * List all checkpoints ordered by number DESC (most recent first),
 * optionally filtered to a specific issue_slug.
 */
export declare function listCheckpoints(db: StoragePort, issue_slug?: string, tx?: StorageTx): Promise<Checkpoint[]>;
//# sourceMappingURL=crud.d.ts.map