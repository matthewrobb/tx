import type { TaskContext, ArtifactContext } from '../../types/expressions.js';
/**
 * Build a TaskContext from an array of task-like objects.
 *
 * Only requires `{ done: boolean }` — doesn't depend on the full Task type,
 * so it works with any data source that tracks completion.
 */
export declare function buildTaskContext(tasks: {
    done: boolean;
}[]): TaskContext;
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
export declare function buildArtifactContext(required: string[], present: string[]): ArtifactContext;
//# sourceMappingURL=context.d.ts.map