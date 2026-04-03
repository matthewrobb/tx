import type { Cycle } from '../types/cycle.js';
import type { Issue } from '../types/issue.js';
export interface RetroData {
    cycle: Cycle;
    completed: Issue[];
    carried_over: Issue[];
    summary: string;
}
/**
 * Generate a markdown retro document from cycle data.
 *
 * Pure function — no side effects, no I/O. The caller (closeCycle) is
 * responsible for persisting the result via createCheckpoint().
 */
export declare function generateRetro(data: RetroData): string;
//# sourceMappingURL=retro.d.ts.map