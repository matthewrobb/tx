import type { Issue } from '../../types/issue.js';
import type { Cycle } from '../../types/cycle.js';
/**
 * Minimal note shape used by renderIssue.
 * Matches the `notes` table columns returned by the DB query in the adapter.
 */
export interface Note {
    id: string;
    summary: string;
    tag: string;
    created_at: string;
}
/**
 * Minimal task shape used by renderIssue.
 * `done` mirrors the INTEGER column (0 | 1) cast to boolean by the adapter.
 */
export interface Task {
    id: string;
    summary: string;
    done: boolean;
    created_at: string;
}
/**
 * Render an issue to a markdown string.
 *
 * Sections:
 *   - Header with all core fields
 *   - Body (falls back to "*No description.*" when null)
 *   - Tasks rendered as GitHub-style checkboxes
 *   - Notes rendered with tag label and date
 *
 * tasks and notes arrays may be empty — sections are still emitted for
 * consistency (empty state is explicit, not absent).
 */
export declare function renderIssue(issue: Issue, notes: Note[], tasks: Task[]): string;
/**
 * Render a cycle summary to a markdown string.
 *
 * issueCount and completedCount are passed in rather than computed here —
 * the adapter queries the DB for the counts and hands them to this function.
 */
export declare function renderCycle(cycle: Cycle, issueCount: number, completedCount: number): string;
/**
 * Render a snapshot index of all open (or passed-in) issues as a markdown table.
 *
 * The caller decides which issues to include — typically all non-archived issues.
 * An empty list still emits the table header for a consistent file shape.
 */
export declare function renderSnapshot(issues: Issue[]): string;
//# sourceMappingURL=renderer.d.ts.map