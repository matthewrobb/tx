// src/engine/expressions/context.ts — Builder utilities for ExpressionContext
//
// These helpers construct the sub-contexts (TaskContext, ArtifactContext) from
// runtime data. They're used by the engine when preparing context for expression
// evaluation — separating construction from evaluation keeps the evaluator pure.
/**
 * Build a TaskContext from an array of task-like objects.
 *
 * Only requires `{ done: boolean }` — doesn't depend on the full Task type,
 * so it works with any data source that tracks completion.
 */
export function buildTaskContext(tasks) {
    const doneCount = tasks.filter((t) => t.done).length;
    return {
        all_done: tasks.length > 0 && doneCount === tasks.length,
        done_count: doneCount,
        total_count: tasks.length,
    };
}
/**
 * Build an ArtifactContext from required and present artifact paths.
 *
 * `required` is the list of artifact paths the step declares via `produces`.
 * `present` is the subset of those that actually exist on disk.
 *
 * The `exists` function checks membership in the present set — the caller
 * is responsible for determining which files exist (filesystem check happens
 * outside the expression system to keep it pure).
 */
export function buildArtifactContext(required, present) {
    const presentSet = new Set(present);
    return {
        all_present: required.length > 0 && required.every((p) => presentSet.has(p)),
        exists: (path) => presentSet.has(path),
    };
}
//# sourceMappingURL=context.js.map