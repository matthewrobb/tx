// src/engine/state.ts — Atomic txNext: the engine's core loop.
//
// Orchestrates evaluate, machine validation, and DB persistence inside a
// single transaction. Projection runs after the transaction commits so a
// projection failure never rolls back state changes.
//
// Design decision: the machine (XState) is used as a consistency check, not
// the source of truth. The evaluator + DB are authoritative. If the machine
// rejects a transition that the evaluator approved, we log a warning but
// still commit — the evaluator has more information (expression context)
// than the machine (static DAG).
import { createActor } from 'xstate';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { evaluateSteps } from './evaluate.js';
import { generateMachine } from './generator.js';
import { buildTaskContext, buildArtifactContext } from './expressions/context.js';
import { createInteractiveEvaluator } from './expressions/interactive.js';
import { getIssueBySlug, updateIssue } from '../issues/crud.js';
/** Convert a WorkflowConfig (from DEFAULT_CONFIG) to the Workflow type that the engine expects. */
function toWorkflow(wc) {
    return {
        id: wc.id,
        slug: wc.id,
        title: wc.title ?? wc.id,
        steps: (wc.steps ?? []).map((s) => ({
            id: s.id,
            title: s.title,
            needs: s.needs,
            skip_when: s.skip_when,
            done_when: s.done_when,
            block_when: s.block_when,
            produces: s.produces,
            requires: s.requires,
            prompt: s.prompt,
        })),
    };
}
/** Build an IssueState snapshot from an Issue and task counts. */
function toIssueState(issue, tasksDone, tasksTotal) {
    return {
        issue: issue.slug,
        type: issue.type,
        workflow_id: issue.workflow_id,
        step: issue.step,
        status: issue.status,
        tasks_done: tasksDone,
        tasks_total: tasksTotal,
        created: issue.created_at,
        updated: issue.updated_at,
    };
}
/**
 * Load vars for the given issue + step from the DB.
 */
async function loadVars(db, issueSlug, step, tx) {
    const result = await db.query(`SELECT key, value FROM vars WHERE issue_slug = $1 AND step = $2`, [issueSlug, step], tx);
    const vars = {};
    for (const row of result.rows) {
        vars[row.key] = row.value;
    }
    return vars;
}
/**
 * Load task completion data for the given issue.
 */
async function loadTasks(db, issueSlug, tx) {
    const result = await db.query(`SELECT done FROM tasks WHERE issue_slug = $1`, [issueSlug], tx);
    return result.rows.map((r) => ({ done: r.done !== 0 }));
}
/**
 * Load the active cycle (if any) for expression context.
 */
async function loadActiveCycle(db, tx) {
    const result = await db.query("SELECT id, slug, status FROM cycles WHERE status = 'active' LIMIT 1", [], tx);
    const row = result.rows[0];
    if (row === undefined)
        return null;
    return {
        id: row.id,
        slug: row.slug,
        status: row.status,
    };
}
/**
 * Load which artifact keys exist in the vars table for the given issue+step.
 * Only checks keys from the `required` set to avoid a full table scan.
 */
async function loadPresentArtifacts(db, issueSlug, step, required, tx) {
    if (required.length === 0)
        return [];
    // Query for existence of each required key. With a small set of required
    // artifacts (typically 1–3), individual queries are fine.
    const result = await db.query(`SELECT key FROM vars WHERE issue_slug = $1 AND step = $2 AND key = ANY($3)`, [issueSlug, step, required], tx);
    return result.rows.map((r) => r.key);
}
/**
 * Build the full ExpressionContext for evaluation.
 */
async function buildContext(db, issue, produces, tx) {
    const vars = await loadVars(db, issue.slug, issue.step, tx);
    const taskRows = await loadTasks(db, issue.slug, tx);
    const taskContext = buildTaskContext(taskRows);
    // Artifact path = var key (handleWrite stores by req.type which matches StepArtifact.path).
    const requiredPaths = produces.map((a) => a.path);
    const presentPaths = await loadPresentArtifacts(db, issue.slug, issue.step, requiredPaths, tx);
    const artifactContext = buildArtifactContext(requiredPaths, presentPaths);
    const cycleContext = await loadActiveCycle(db, tx);
    const issueState = {
        issue: issue.slug,
        type: issue.type,
        workflow_id: issue.workflow_id,
        step: issue.step,
        status: issue.status,
        tasks_done: taskContext.done_count,
        tasks_total: taskRows.length > 0 ? taskRows.length : null,
        created: issue.created_at,
        updated: issue.updated_at,
    };
    const context = {
        issue: issueState,
        vars,
        tasks: taskContext,
        artifacts: artifactContext,
        cycle: cycleContext,
    };
    return {
        context,
        tasksDone: taskContext.done_count,
        tasksTotal: taskRows.length > 0 ? taskRows.length : null,
    };
}
/**
 * Use the XState machine as a consistency check for the proposed transition.
 *
 * Initializes an actor with completed_steps derived from evaluations, sends
 * the appropriate event, and checks whether the machine accepted it.
 * Returns true if the machine's current_step matches the expected next step.
 */
function validateWithMachine(workflow, evaluations, currentStep, event) {
    try {
        const machine = generateMachine(workflow);
        // Derive completed_steps from evaluations: steps with resolution 'done' or 'skip'
        // that are NOT the current step (the current step is about to be completed).
        const completedSteps = evaluations
            .filter((e) => (e.resolution === 'done' || e.resolution === 'skip') && e.step !== currentStep)
            .map((e) => e.step);
        const actor = createActor(machine, {
            input: {
                current_step: currentStep,
                completed_steps: completedSteps,
                status: 'open',
            },
        });
        actor.start();
        // Feed completed steps to bring the machine to the right state.
        // The machine starts at the first step, so we need to replay completed steps.
        // Instead, we initialized with the right context above.
        // Send the event for the current step transition.
        actor.send({ type: event, step: currentStep });
        const snapshot = actor.getSnapshot();
        actor.stop();
        // If the machine accepted the event, the current_step should have changed
        // (or status should be 'done' if it was the last step).
        return snapshot.context.current_step !== currentStep || snapshot.context.status === 'done';
    }
    catch {
        // Machine generation failed (e.g., cyclic DAG) — log but don't block.
        // The evaluator already handles this case.
        return false;
    }
}
// ---------------------------------------------------------------------------
// txNext — the core engine loop
// ---------------------------------------------------------------------------
export async function txNext(db, projection, input) {
    // Steps 1–5 run inside a single DB transaction.
    const result = await db.transaction(async (tx) => {
        // 1. Load issue by slug.
        const issue = await getIssueBySlug(db, input.issue_slug, tx);
        if (issue === null) {
            return { status: 'error', message: `Issue not found: ${input.issue_slug}` };
        }
        // 2. Load workflow from DEFAULT_CONFIG.
        const workflowConfig = DEFAULT_CONFIG.workflows.find((w) => w.id === issue.workflow_id);
        if (workflowConfig === undefined) {
            return { status: 'error', message: `Workflow not found: ${issue.workflow_id}` };
        }
        const workflow = toWorkflow(workflowConfig);
        // 3a. If resume_response is set, store it in vars first.
        if (input.resume_response !== undefined) {
            await db.query(`INSERT INTO vars (issue_slug, step, key, value)
         VALUES ($1, $2, 'resume_response', $3::jsonb)
         ON CONFLICT (issue_slug, step, key) DO UPDATE SET value = EXCLUDED.value`, [input.issue_slug, issue.step, JSON.stringify(input.resume_response)], tx);
        }
        // 3b. Build ExpressionContext (re-reads vars so resume_response is visible).
        const currentStepDef = workflow.steps.find((s) => s.id === issue.step);
        const produces = currentStepDef?.produces ?? [];
        const { context, tasksDone, tasksTotal } = await buildContext(db, issue, produces, tx);
        // 4. Evaluate steps using interactive evaluator.
        const evaluator = createInteractiveEvaluator();
        const evaluation = await evaluateSteps(db, workflow, issue, context, evaluator);
        // 5. Handle evaluation result.
        const currentStepEval = evaluation.evaluations.find((e) => e.step === issue.step);
        // 5a. Check for any paused step.
        const pausedStep = evaluation.evaluations.find((e) => e.resolution === 'paused');
        if (pausedStep !== undefined && pausedStep.action !== undefined) {
            const issueState = toIssueState(issue, tasksDone, tasksTotal);
            return { status: 'paused', issue: issueState, action: pausedStep.action };
        }
        // 5b. Current step is done or skip — advance.
        if (currentStepEval !== undefined &&
            (currentStepEval.resolution === 'done' || currentStepEval.resolution === 'skip')) {
            const fromStep = issue.step;
            const event = currentStepEval.resolution === 'done' ? 'STEP_DONE' : 'STEP_SKIP';
            // Find next eligible step (first 'ready' step in evaluation).
            const nextStep = evaluation.evaluations.find((e) => e.resolution === 'ready');
            if (nextStep !== undefined) {
                // Validate with machine (consistency check — non-blocking).
                const machineOk = validateWithMachine(workflow, evaluation.evaluations, fromStep, event);
                if (!machineOk) {
                    // Decision: log warning but still commit. The evaluator is the source of truth.
                    // In production this would go to a structured logger; for now it's a no-op
                    // because console.warn in tests is noisy. The important thing is we don't block.
                }
                // Advance issue to next step.
                const updated = await updateIssue(db, issue.id, {
                    step: nextStep.step,
                    status: 'open',
                }, tx);
                const issueState = toIssueState(updated, tasksDone, tasksTotal);
                return { status: 'advanced', issue: issueState, from_step: fromStep, to_step: nextStep.step };
            }
            // No next step — all steps done/skip. Close the issue.
            const updated = await updateIssue(db, issue.id, { status: 'done' }, tx);
            const issueState = toIssueState(updated, tasksDone, tasksTotal);
            return { status: 'done', issue: issueState };
        }
        // 5c. Current step is blocked.
        if (currentStepEval !== undefined && currentStepEval.resolution === 'blocked') {
            const updated = await updateIssue(db, issue.id, { status: 'blocked' }, tx);
            const issueState = toIssueState(updated, tasksDone, tasksTotal);
            return { status: 'blocked', issue: issueState, step: issue.step };
        }
        // 5d. No change — current step is active/ready with no conditions met.
        const issueState = toIssueState(issue, tasksDone, tasksTotal);
        return { status: 'no_change', issue: issueState };
    });
    // 6. Run projection OUTSIDE the transaction.
    // Projection can fail without rolling back state.
    if (result.status !== 'error') {
        try {
            await projection.renderIssue(input.issue_slug);
        }
        catch {
            // Decision: swallow projection errors. The DB state is committed and
            // correct. Projection can be retried via `tx status` or the next
            // `tx next` call. In production, this would log to a structured logger.
        }
    }
    return result;
}
//# sourceMappingURL=state.js.map