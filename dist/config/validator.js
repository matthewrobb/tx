/**
 * Config validator — validates a resolved TwistedConfig and brands it as ValidConfig.
 *
 * Collects ALL errors before returning (never short-circuits on first error).
 * Returns a discriminated union: { ok: true, config: ValidConfig } | { ok: false, errors }.
 *
 * Validation order:
 *   1. Version check
 *   2. Duplicate workflow IDs
 *   3. Extends chain resolution (unknown refs + cycles)
 *   4. DAG validity per workflow
 *   5. Expression syntax in step conditions
 */
import { resolveDag } from '../engine/dag.js';
import { ExpressionEvaluator } from '../engine/expressions/evaluator.js';
// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------
export function validateConfig(config) {
    const errors = [];
    const evaluator = new ExpressionEvaluator();
    // 1. Version check
    if (config.version !== '4.0') {
        errors.push({ kind: 'invalid_version', found: config.version ?? '' });
    }
    // 2. Duplicate workflow IDs
    const seenIds = new Set();
    for (const workflow of config.workflows) {
        if (seenIds.has(workflow.id)) {
            errors.push({ kind: 'duplicate_workflow_id', id: workflow.id });
        }
        seenIds.add(workflow.id);
    }
    // Build a lookup for extends resolution (only unique IDs to avoid confusion)
    const workflowById = new Map();
    for (const workflow of config.workflows) {
        // First occurrence wins — duplicates are already flagged above
        if (!workflowById.has(workflow.id)) {
            workflowById.set(workflow.id, workflow);
        }
    }
    // 3. Extends chain resolution
    for (const workflow of config.workflows) {
        if (workflow.extends === undefined)
            continue;
        // Check that the referenced workflow exists
        if (!workflowById.has(workflow.extends)) {
            errors.push({
                kind: 'unknown_extends',
                workflow: workflow.id,
                extends_id: workflow.extends,
            });
            continue;
        }
        // Check for cycles in the extends chain
        const chain = [workflow.id];
        const visited = new Set([workflow.id]);
        let current = workflow.extends;
        while (current !== undefined) {
            if (visited.has(current)) {
                // Cycle detected — report the chain from the cycle start
                const cycleStart = chain.indexOf(current);
                const cycle = cycleStart >= 0 ? chain.slice(cycleStart) : chain;
                errors.push({ kind: 'extends_cycle', chain: [...cycle, current] });
                break;
            }
            const target = workflowById.get(current);
            if (!target) {
                // Unknown extends — already caught above for the root workflow,
                // but intermediate chains might also reference unknowns.
                // Don't double-report; just stop traversal.
                break;
            }
            visited.add(current);
            chain.push(current);
            current = target.extends;
        }
    }
    // 4. DAG validity per workflow
    for (const workflow of config.workflows) {
        if (!workflow.steps || workflow.steps.length === 0)
            continue;
        const dagResult = resolveDag(workflow.steps);
        if (dagResult.ok === false) {
            errors.push({
                kind: 'dag_cycle',
                workflow: workflow.id,
                cycles: dagResult.cycles,
            });
        }
    }
    // 5. Expression syntax validation
    const expressionFields = ['skip_when', 'done_when', 'block_when'];
    for (const workflow of config.workflows) {
        if (!workflow.steps)
            continue;
        for (const step of workflow.steps) {
            for (const field of expressionFields) {
                const expr = step[field];
                if (expr === undefined)
                    continue;
                const result = evaluator.validate(expr);
                if (result.valid === false) {
                    errors.push({
                        kind: 'invalid_expression',
                        workflow: workflow.id,
                        step: step.id,
                        field,
                        error: result.error,
                    });
                }
            }
        }
    }
    // Return result
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    // Stamp the brand at runtime so consuming code can assert on it.
    // Object.defineProperty with non-enumerable prevents it from polluting
    // JSON serialization while still being accessible for runtime checks.
    const branded = config;
    Object.defineProperty(branded, '_brand', {
        value: 'ValidConfig',
        writable: false,
        enumerable: false,
        configurable: false,
    });
    return { ok: true, config: branded };
}
//# sourceMappingURL=validator.js.map