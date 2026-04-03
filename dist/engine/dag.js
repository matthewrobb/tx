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
/**
 * Resolve a set of workflow steps into a topological order
 * and parallel execution groups.
 *
 * @param steps - The workflow step definitions forming the DAG.
 * @returns A DagResult indicating success (with order and groups)
 *          or failure (with detected cycles).
 */
export function resolveDag(steps) {
    // --- Validation ---
    const ids = new Set();
    const duplicates = [];
    for (const step of steps) {
        if (ids.has(step.id)) {
            duplicates.push(step.id);
        }
        ids.add(step.id);
    }
    if (duplicates.length > 0) {
        // Duplicate IDs make the graph ambiguous — report as a cycle-like error.
        // Decision: return error rather than throw, keeping the API uniform.
        // The caller always gets a DagResult, never an exception.
        return {
            ok: false,
            cycles: duplicates.map((id) => [id]),
        };
    }
    // Check for unknown dependencies (edges pointing to non-existent nodes).
    const unknownDeps = [];
    for (const step of steps) {
        for (const dep of step.needs) {
            if (!ids.has(dep)) {
                unknownDeps.push({ step: step.id, unknown: dep });
            }
        }
    }
    if (unknownDeps.length > 0) {
        // Unknown dependencies make the graph incomplete — can't resolve.
        // Report each unknown-dep pair as its own "cycle" entry so the caller
        // sees exactly which step references which missing ID.
        return {
            ok: false,
            cycles: unknownDeps.map(({ step, unknown }) => [step, unknown]),
        };
    }
    // --- Kahn's algorithm ---
    // Build adjacency list and in-degree map.
    const inDegree = new Map();
    const dependents = new Map(); // node -> nodes that depend on it
    for (const step of steps) {
        inDegree.set(step.id, 0);
        dependents.set(step.id, []);
    }
    for (const step of steps) {
        // Set in-degree based on number of dependencies
        inDegree.set(step.id, step.needs.length);
        // For each dependency, record that `step.id` depends on it
        for (const dep of step.needs) {
            dependents.get(dep).push(step.id);
        }
    }
    // Collect initial zero-in-degree nodes (no dependencies).
    let currentLevel = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0) {
            currentLevel.push(id);
        }
    }
    // Sort for deterministic output within each level.
    currentLevel.sort();
    const order = [];
    const groups = [];
    // Process level by level — each level is a parallel execution group.
    while (currentLevel.length > 0) {
        groups.push([...currentLevel]);
        order.push(...currentLevel);
        const nextLevel = [];
        for (const node of currentLevel) {
            for (const dependent of dependents.get(node)) {
                const newDegree = inDegree.get(dependent) - 1;
                inDegree.set(dependent, newDegree);
                if (newDegree === 0) {
                    nextLevel.push(dependent);
                }
            }
        }
        // Sort for deterministic output.
        nextLevel.sort();
        currentLevel = nextLevel;
    }
    // --- Cycle detection ---
    if (order.length < steps.length) {
        // Some nodes were never processed — they're part of cycles.
        // Find all nodes that still have non-zero in-degree.
        const cycleNodes = new Set();
        for (const [id, degree] of inDegree) {
            if (degree > 0) {
                cycleNodes.add(id);
            }
        }
        // Trace individual cycles by following dependency chains among
        // the unprocessed nodes. This gives meaningful cycle reports
        // rather than just dumping all stuck nodes into one group.
        const cycles = traceCycles(cycleNodes, steps);
        return { ok: false, cycles };
    }
    return { ok: true, order, groups };
}
/**
 * Trace individual cycles from a set of nodes known to be in cycles.
 *
 * Walks dependency edges (restricted to the cycle-node set) to find
 * distinct cycles. Each cycle is reported as the ordered list of
 * participating step IDs.
 */
function traceCycles(cycleNodes, steps) {
    // Build a lookup for quick access to step dependencies.
    const stepMap = new Map();
    for (const step of steps) {
        stepMap.set(step.id, step);
    }
    const visited = new Set();
    const cycles = [];
    for (const startNode of cycleNodes) {
        if (visited.has(startNode))
            continue;
        // Walk the dependency chain from startNode, staying within cycleNodes.
        const path = [];
        const pathSet = new Set();
        let current = startNode;
        // Follow edges until we revisit a node (cycle found) or dead-end.
        while (true) {
            if (pathSet.has(current)) {
                // Found a cycle — extract just the cycle portion.
                const cycleStart = path.indexOf(current);
                const cycle = path.slice(cycleStart);
                cycle.sort(); // Deterministic ordering for test assertions.
                cycles.push(cycle);
                // Mark all nodes in this cycle as visited.
                for (const node of cycle) {
                    visited.add(node);
                }
                break;
            }
            if (!cycleNodes.has(current) || visited.has(current)) {
                // Reached a node outside the cycle set or already processed.
                break;
            }
            path.push(current);
            pathSet.add(current);
            // Pick the next unvisited dependency within the cycle set.
            const step = stepMap.get(current);
            const nextDep = step.needs.find((dep) => cycleNodes.has(dep) && !visited.has(dep));
            if (nextDep === undefined) {
                // No unvisited cycle-set neighbor — shouldn't happen for true
                // cycle nodes, but guard against it. Mark current path as visited.
                for (const node of path) {
                    visited.add(node);
                }
                break;
            }
            current = nextDep;
        }
    }
    return cycles;
}
//# sourceMappingURL=dag.js.map