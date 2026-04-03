// src/engine/evaluate.ts — Step evaluation against DB state via expressions.
//
// Evaluates every step in a workflow's DAG order, resolving each to a
// StepResolution. The algorithm walks steps topologically, checking
// dependencies first, then expression conditions (skip_when, done_when,
// block_when), then the issue's current step pointer.
//
// Design decision: the function receives a pre-built ExpressionContext
// rather than querying the DB directly. This keeps it pure and testable
// with mock contexts. The `db` parameter is in the signature for future
// use (e.g., per-step context enrichment) but is not used in the
// current implementation.
import { resolveDag } from './dag.js';
// ---------------------------------------------------------------------------
// evaluateSteps
// ---------------------------------------------------------------------------
/**
 * Evaluate all steps in a workflow for a given issue and context.
 *
 * Walks steps in topological order (from resolveDag). For each step:
 *   1. Check dependencies — any needed step not done/skip => 'pending'
 *   2. Evaluate skip_when — true => 'skip'
 *   3. Evaluate done_when — true => 'done'
 *   4. Evaluate block_when — true => 'blocked'
 *   5. Compare to issue.step — match => 'active'
 *   6. Otherwise => 'ready'
 *
 * If any expression returns a paused result, the step is marked 'paused'
 * with the associated AgentAction.
 *
 * @param _db - StoragePort reserved for future per-step context queries.
 * @param workflow - The workflow whose steps to evaluate.
 * @param issue - The issue being evaluated (provides current step pointer).
 * @param context - Pre-built ExpressionContext for expression evaluation.
 * @param evaluator - Expression evaluator (supports interactive functions).
 */
export async function evaluateSteps(_db, workflow, issue, context, evaluator) {
    const dag = resolveDag(workflow.steps);
    // If the DAG has cycles, every step is blocked — the workflow is invalid.
    // This shouldn't happen in practice (validated at config time), but we
    // handle it defensively rather than throwing.
    if (!dag.ok) {
        const evaluations = workflow.steps.map((s) => ({
            step: s.id,
            resolution: 'blocked',
        }));
        return { evaluations, current_step: null, status: 'blocked' };
    }
    // Build a step lookup for O(1) access by ID.
    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
    // Track which steps are resolved as done or skip — downstream steps
    // check this set to determine if their dependencies are satisfied.
    const completedSteps = new Set();
    const evaluations = [];
    let currentStep = null;
    for (const stepId of dag.order) {
        const stepDef = stepMap.get(stepId);
        // 1. Check dependencies — all needed steps must be done or skip.
        const missingNeeds = stepDef.needs.filter((dep) => !completedSteps.has(dep));
        if (missingNeeds.length > 0) {
            evaluations.push({
                step: stepId,
                resolution: 'pending',
                missing_needs: missingNeeds,
            });
            continue;
        }
        // 2. Check skip_when — if true, mark skip and add to completedSteps.
        if (stepDef.skip_when) {
            const skipResult = evaluateCondition(evaluator, stepDef.skip_when, context);
            if (skipResult.resolution !== null) {
                if (skipResult.resolution === 'paused') {
                    evaluations.push({
                        step: stepId,
                        resolution: 'paused',
                        action: skipResult.action,
                    });
                    continue;
                }
                // skip_when evaluated true
                completedSteps.add(stepId);
                evaluations.push({ step: stepId, resolution: 'skip' });
                continue;
            }
            // skip_when was false — fall through to next checks
        }
        // 3. Check done_when — if true, mark done and add to completedSteps.
        if (stepDef.done_when) {
            const doneResult = evaluateCondition(evaluator, stepDef.done_when, context);
            if (doneResult.resolution !== null) {
                if (doneResult.resolution === 'paused') {
                    evaluations.push({
                        step: stepId,
                        resolution: 'paused',
                        action: doneResult.action,
                    });
                    continue;
                }
                // done_when evaluated true
                completedSteps.add(stepId);
                evaluations.push({ step: stepId, resolution: 'done' });
                continue;
            }
            // done_when was false — fall through
        }
        // 4. Check block_when — if true, mark blocked.
        if (stepDef.block_when) {
            const blockResult = evaluateCondition(evaluator, stepDef.block_when, context);
            if (blockResult.resolution !== null) {
                if (blockResult.resolution === 'paused') {
                    evaluations.push({
                        step: stepId,
                        resolution: 'paused',
                        action: blockResult.action,
                    });
                    continue;
                }
                // block_when evaluated true
                evaluations.push({ step: stepId, resolution: 'blocked' });
                continue;
            }
            // block_when was false — fall through
        }
        // 5. Check if this is the current step on the issue.
        if (stepId === issue.step) {
            evaluations.push({ step: stepId, resolution: 'active' });
            if (currentStep === null)
                currentStep = stepId;
            continue;
        }
        // 6. All dependencies met, no conditions triggered — step is ready.
        evaluations.push({ step: stepId, resolution: 'ready' });
        if (currentStep === null)
            currentStep = stepId;
    }
    // Derive overall status from the evaluations.
    const status = deriveStatus(evaluations);
    return { evaluations, current_step: currentStep, status };
}
/**
 * Evaluate a condition expression string and classify the result.
 *
 * - If the expression returns a paused result, returns { resolution: 'paused', action }.
 * - If the expression evaluates truthy, returns { resolution: 'triggered' }.
 * - If the expression evaluates falsy or errors, returns { resolution: null }.
 *
 * Design decision: expression errors (ok: false) are treated as falsy rather
 * than blocking the step. This is intentional — a malformed expression in
 * skip_when shouldn't block the entire workflow. Errors should be caught
 * at config validation time (S-007), not at evaluation time.
 */
function evaluateCondition(evaluator, expression, context) {
    const result = evaluator.evaluate(expression, context);
    if (result.ok === 'paused') {
        return { resolution: 'paused', action: result.action };
    }
    if (result.ok === true && isTruthy(result.value)) {
        return { resolution: 'triggered' };
    }
    // False, null, error — condition not triggered.
    return { resolution: null };
}
/**
 * Truthiness check matching the evaluator's semantics.
 * See ExpressionEvaluator for the full truthiness rules.
 */
function isTruthy(value) {
    if (value === null || value === undefined)
        return false;
    if (value === false)
        return false;
    if (value === 0)
        return false;
    if (value === '')
        return false;
    return true;
}
/**
 * Derive the overall IssueStatus from step evaluations.
 *
 * - 'done' if every step is done or skip.
 * - 'blocked' if any step is blocked or paused.
 * - 'open' otherwise (at least one step is pending, ready, or active).
 */
function deriveStatus(evaluations) {
    const allTerminal = evaluations.every((e) => e.resolution === 'done' || e.resolution === 'skip');
    if (allTerminal)
        return 'done';
    const hasBlocked = evaluations.some((e) => e.resolution === 'blocked' || e.resolution === 'paused');
    if (hasBlocked)
        return 'blocked';
    return 'open';
}
//# sourceMappingURL=evaluate.js.map