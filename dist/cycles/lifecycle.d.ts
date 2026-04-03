import type { StoragePort } from '../ports/storage.js';
import type { Cycle } from '../types/cycle.js';
import type { Issue } from '../types/issue.js';
export interface StartCycleInput {
    slug: string;
    title: string;
    description?: string;
}
export interface PullResult {
    cycle: Cycle;
    pulled: Issue[];
    skipped: Issue[];
}
export interface CloseCycleInput {
    cycleSlug: string;
    summary: string;
}
export interface CloseCycleResult {
    cycle: Cycle;
    retro: string;
    checkpointId: string;
    completed: number;
    carried_over: number;
}
/**
 * Start a new cycle.
 *
 * Enforces a single-active-cycle invariant: errors if any cycle with
 * status = 'active' already exists.
 */
export declare function startCycle(db: StoragePort, input: StartCycleInput): Promise<Cycle>;
/**
 * Pull issues into an active cycle.
 *
 * When `issueSlugs` is empty, auto-pulls all open issues not already in the
 * cycle. Issues already in the cycle or with status 'done' go to `skipped`.
 */
export declare function pullIssues(db: StoragePort, cycleSlug: string, issueSlugs: string[]): Promise<PullResult>;
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
export declare function closeCycle(db: StoragePort, input: CloseCycleInput): Promise<CloseCycleResult>;
//# sourceMappingURL=lifecycle.d.ts.map