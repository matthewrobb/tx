// src/adapters/markdown/renderer.ts — Pure markdown generation functions.
//
// No I/O, no DB queries — each function takes data and returns a string.
// The adapter (adapter.ts) queries the DB and calls these functions.
//
// Kept as pure functions so they are trivially testable without any mocking.
// ── Renderers ─────────────────────────────────────────────────
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
export function renderIssue(issue, notes, tasks) {
    const bodyText = issue.body != null ? issue.body : '*No description.*';
    const taskLines = tasks.length === 0
        ? ['*No tasks.*']
        : tasks.map((t) => {
            const checkbox = t.done ? '[x]' : '[ ]';
            return `- ${checkbox} ${t.id} ${t.summary}`;
        });
    const noteBlocks = notes.length === 0
        ? ['*No notes.*']
        : notes.map((n) => {
            const date = n.created_at.slice(0, 10); // ISO date portion only
            return [`### [${n.tag}] ${n.summary}`, `*${date}*`].join('\n');
        });
    return [
        `# ${issue.title}`,
        '',
        `**Type:** ${issue.type}  `,
        `**Status:** ${issue.status}  `,
        `**Step:** ${issue.step}  `,
        `**Workflow:** ${issue.workflow_id}  `,
        `**Created:** ${issue.created_at}  `,
        `**Updated:** ${issue.updated_at}`,
        '',
        '## Body',
        '',
        bodyText,
        '',
        '## Tasks',
        '',
        ...taskLines,
        '',
        '## Notes',
        '',
        ...noteBlocks,
    ].join('\n');
}
/**
 * Render a cycle summary to a markdown string.
 *
 * issueCount and completedCount are passed in rather than computed here —
 * the adapter queries the DB for the counts and hands them to this function.
 */
export function renderCycle(cycle, issueCount, completedCount) {
    const closedLine = cycle.closed_at != null ? cycle.closed_at : 'active';
    return [
        `# ${cycle.title}`,
        '',
        `**Status:** ${cycle.status}  `,
        `**Started:** ${cycle.started_at}  `,
        `**Closed:** ${closedLine}`,
        '',
        '## Issues',
        '',
        `${issueCount} total, ${completedCount} completed`,
    ].join('\n');
}
/**
 * Render a snapshot index of all open (or passed-in) issues as a markdown table.
 *
 * The caller decides which issues to include — typically all non-archived issues.
 * An empty list still emits the table header for a consistent file shape.
 */
export function renderSnapshot(issues) {
    const header = [
        '# Active Issues',
        '',
        '| Slug | Title | Type | Step | Status |',
        '|------|-------|------|------|--------|',
    ];
    const rows = issues.map((i) => `| ${i.slug} | ${i.title} | ${i.type} | ${i.step} | ${i.status} |`);
    return [...header, ...rows].join('\n');
}
//# sourceMappingURL=renderer.js.map