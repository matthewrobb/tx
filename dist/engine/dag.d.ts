/**
 * DAG resolver — topological sort with parallel group detection.
 *
 * Pure algorithm module. No side effects, no I/O, no async.
 * Only imports from src/types/.
 *
 * Uses Kahn's algorithm (BFS-based) rather than DFS because:
 * 1. It naturally produces parallel execution groups (each BFS level
 *    is a set of steps whose dependencies are all satisfied).
 * 2. Cycle detection falls out for free — any unprocessed nodes
 *    after BFS completes are part of cycles.
 * 3. The iterative approach is easier to reason about and debug
 *    than recursive DFS with coloring.
 */
import type { StepDef } from '../types/workflow.js';
export type DagResult = {
    ok: true;
    order: string[];
    groups: string[][];
} | {
    ok: false;
    cycles: string[][];
};
/**
 * Resolve a set of workflow steps into a topological order
 * and parallel execution groups.
 *
 * @param steps - The workflow step definitions forming the DAG.
 * @returns A DagResult indicating success (with order and groups)
 *          or failure (with detected cycles).
 */
export declare function resolveDag(steps: StepDef[]): DagResult;
//# sourceMappingURL=dag.d.ts.map