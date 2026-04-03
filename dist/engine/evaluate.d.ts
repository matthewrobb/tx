import type { StoragePort } from '../ports/storage.js';
import type { ExpressionEvaluatorPort } from '../ports/expression.js';
import type { Workflow } from '../types/workflow.js';
import type { Issue, IssueStatus } from '../types/issue.js';
import type { ExpressionContext } from '../types/expressions.js';
import type { AgentAction } from '../types/protocol.js';
export type StepResolution = 'pending' | 'ready' | 'active' | 'skip' | 'done' | 'blocked' | 'paused';
export interface StepEvaluation {
    step: string;
    resolution: StepResolution;
    action?: AgentAction;
    missing_needs?: string[];
}
export interface EvaluationResult {
    evaluations: StepEvaluation[];
    /** The active step (if any) — the first 'ready' or 'active' step. */
    current_step: string | null;
    /** Overall issue status derived from evaluations. */
    status: IssueStatus;
}
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
export declare function evaluateSteps(_db: StoragePort, workflow: Workflow, issue: Issue, context: ExpressionContext, evaluator: ExpressionEvaluatorPort): Promise<EvaluationResult>;
//# sourceMappingURL=evaluate.d.ts.map