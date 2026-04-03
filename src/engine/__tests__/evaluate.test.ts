import { describe, test, expect } from 'vitest';
import { evaluateSteps } from '../evaluate.js';
import type { StepEvaluation, EvaluationResult } from '../evaluate.js';
import type { Workflow, WorkflowId, StepDef } from '../../types/workflow.js';
import type { Issue, IssueId } from '../../types/issue.js';
import type { ExpressionContext } from '../../types/expressions.js';
import type { StoragePort } from '../../ports/storage.js';
import { ExpressionEvaluator } from '../expressions/evaluator.js';
import { createInteractiveEvaluator } from '../expressions/interactive.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Null StoragePort — evaluateSteps doesn't query the DB in the current
 * implementation, so we pass a stub that throws if called.
 */
const nullDb: StoragePort = {
  async query() { throw new Error('DB should not be called'); },
  async exec() { throw new Error('DB should not be called'); },
  async transaction() { throw new Error('DB should not be called'); },
};

/** Minimal issue factory — overrides only what tests need. */
function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'test-issue' as IssueId,
    slug: 'test',
    title: 'Test Issue',
    body: null,
    type: 'feature',
    workflow_id: 'test-workflow',
    step: '',
    status: 'open',
    parent_id: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Minimal workflow factory. */
function makeWorkflow(steps: StepDef[]): Workflow {
  return {
    id: 'test-workflow' as WorkflowId,
    slug: 'test',
    title: 'Test Workflow',
    steps,
  };
}

/** Minimal step factory. */
function step(id: string, overrides: Partial<StepDef> = {}): StepDef {
  return {
    id,
    title: id,
    needs: [],
    ...overrides,
  };
}

/** Default empty context — no vars, no tasks, no artifacts, no cycle. */
function emptyContext(overrides: Partial<ExpressionContext> = {}): ExpressionContext {
  return {
    vars: {},
    issue: {
      issue: 'test',
      type: 'feature',
      workflow_id: 'test-workflow',
      step: '',
      status: 'open',
      tasks_done: 0,
      tasks_total: null,
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    },
    artifacts: {
      all_present: false,
      exists: () => false,
    },
    tasks: {
      all_done: false,
      done_count: 0,
      total_count: 0,
    },
    cycle: null,
    ...overrides,
  };
}

/** Lookup a step evaluation by step ID. */
function findEval(result: EvaluationResult, stepId: string): StepEvaluation | undefined {
  return result.evaluations.find((e) => e.step === stepId);
}

/** Default evaluator — built-in functions only (no interactive). */
const evaluator = new ExpressionEvaluator();

/** Interactive evaluator — includes confirm/prompt/choose. */
const interactiveEvaluator = createInteractiveEvaluator();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateSteps', () => {
  test('1. pending — step B depends on step A; A not done => B is pending', async () => {
    const workflow = makeWorkflow([
      step('a'),
      step('b', { needs: ['a'] }),
    ]);
    const issue = makeIssue({ step: 'a' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalB = findEval(result, 'b')!;
    expect(evalB.resolution).toBe('pending');
    expect(evalB.missing_needs).toEqual(['a']);
  });

  test('2. ready — step with no dependencies, no conditions => ready', async () => {
    const workflow = makeWorkflow([
      step('a'),
      step('b'),
    ]);
    // issue.step points at something else so 'a' isn't active
    const issue = makeIssue({ step: 'x' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalA = findEval(result, 'a')!;
    expect(evalA.resolution).toBe('ready');
  });

  test('3. active — step matching issue.step => active', async () => {
    const workflow = makeWorkflow([
      step('research'),
      step('build', { needs: ['research'] }),
    ]);
    const issue = makeIssue({ step: 'research' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalResearch = findEval(result, 'research')!;
    expect(evalResearch.resolution).toBe('active');
    expect(result.current_step).toBe('research');
  });

  test('4. skip — skip_when evaluates true => skip', async () => {
    const workflow = makeWorkflow([
      step('research', { skip_when: "issue.type == 'chore'" }),
      step('build', { needs: ['research'] }),
    ]);
    const issue = makeIssue({ type: 'chore', step: 'build' });
    const ctx = emptyContext({
      issue: {
        issue: 'test',
        type: 'chore',
        workflow_id: 'test-workflow',
        step: 'build',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalResearch = findEval(result, 'research')!;
    expect(evalResearch.resolution).toBe('skip');
  });

  test('5. done — done_when evaluates true => done', async () => {
    const workflow = makeWorkflow([
      step('research', { done_when: 'artifacts.all_present' }),
    ]);
    const issue = makeIssue({ step: 'research' });
    const ctx = emptyContext({
      artifacts: {
        all_present: true,
        exists: () => true,
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalResearch = findEval(result, 'research')!;
    expect(evalResearch.resolution).toBe('done');
  });

  test('6. blocked — block_when evaluates true => blocked', async () => {
    const workflow = makeWorkflow([
      step('deploy', { block_when: "issue.status == 'blocked'" }),
    ]);
    const issue = makeIssue({ step: 'deploy', status: 'blocked' });
    const ctx = emptyContext({
      issue: {
        issue: 'test',
        type: 'feature',
        workflow_id: 'test-workflow',
        step: 'deploy',
        status: 'blocked',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    const evalDeploy = findEval(result, 'deploy')!;
    expect(evalDeploy.resolution).toBe('blocked');
  });

  test('7. paused — done_when contains confirm() => paused with action', async () => {
    const workflow = makeWorkflow([
      step('deploy', { done_when: "confirm('Ready to deploy?')" }),
    ]);
    const issue = makeIssue({ step: 'deploy' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, interactiveEvaluator);

    const evalDeploy = findEval(result, 'deploy')!;
    expect(evalDeploy.resolution).toBe('paused');
    expect(evalDeploy.action).toBeDefined();
    expect(evalDeploy.action!.type).toBe('confirm');
  });

  test('8. overall done — all steps done or skip => status done', async () => {
    const workflow = makeWorkflow([
      step('a', { done_when: 'artifacts.all_present' }),
      step('b', { skip_when: "issue.type == 'chore'", needs: ['a'] }),
    ]);
    const issue = makeIssue({ type: 'chore', step: 'b' });
    const ctx = emptyContext({
      artifacts: {
        all_present: true,
        exists: () => true,
      },
      issue: {
        issue: 'test',
        type: 'chore',
        workflow_id: 'test-workflow',
        step: 'b',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(result.status).toBe('done');
    // current_step should be null when everything is complete
    expect(result.current_step).toBe(null);
  });

  test('9. linear workflow — evaluate all steps in order, current_step set correctly', async () => {
    const workflow = makeWorkflow([
      step('research', { done_when: 'artifacts.all_present' }),
      step('scope', { needs: ['research'], done_when: "vars.scope_done == true" }),
      step('plan', { needs: ['scope'] }),
      step('build', { needs: ['plan'] }),
    ]);
    // research is done (artifacts present), scope is not done
    const issue = makeIssue({ step: 'scope' });
    const ctx = emptyContext({
      artifacts: {
        all_present: true,
        exists: () => true,
      },
      vars: {},
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(findEval(result, 'research')!.resolution).toBe('done');
    expect(findEval(result, 'scope')!.resolution).toBe('active');
    expect(findEval(result, 'plan')!.resolution).toBe('pending');
    expect(findEval(result, 'build')!.resolution).toBe('pending');

    // current_step is the first ready or active step
    expect(result.current_step).toBe('scope');
    expect(result.status).toBe('open');
  });

  test('10. skip propagation — skipped step satisfies dependency for downstream steps', async () => {
    const workflow = makeWorkflow([
      step('research', { skip_when: "issue.type == 'chore'" }),
      step('build', { needs: ['research'] }),
    ]);
    const issue = makeIssue({ type: 'chore', step: 'build' });
    const ctx = emptyContext({
      issue: {
        issue: 'test',
        type: 'chore',
        workflow_id: 'test-workflow',
        step: 'build',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(findEval(result, 'research')!.resolution).toBe('skip');
    // build should NOT be pending — research was skipped, satisfying the dep
    const evalBuild = findEval(result, 'build')!;
    expect(evalBuild.resolution).toBe('active');
    expect(evalBuild.missing_needs).toBeUndefined();
  });

  test('condition evaluation order — skip_when is checked before done_when', async () => {
    // If both skip_when and done_when would be true, skip_when wins
    // because it's checked first.
    const workflow = makeWorkflow([
      step('a', {
        skip_when: "issue.type == 'chore'",
        done_when: 'artifacts.all_present',
      }),
    ]);
    const issue = makeIssue({ type: 'chore' });
    const ctx = emptyContext({
      artifacts: { all_present: true, exists: () => true },
      issue: {
        issue: 'test',
        type: 'chore',
        workflow_id: 'test-workflow',
        step: '',
        status: 'open',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);
    expect(findEval(result, 'a')!.resolution).toBe('skip');
  });

  test('expression error in skip_when treated as falsy — does not block step', async () => {
    // A malformed expression (unknown function call) returns ok: false,
    // which should be treated as "condition not met" rather than blocking.
    const workflow = makeWorkflow([
      step('a', { skip_when: "nonexistent_function()" }),
    ]);
    const issue = makeIssue({ step: 'a' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    // Should not be 'blocked' — error in skip_when is treated as false
    expect(findEval(result, 'a')!.resolution).toBe('active');
  });

  test('cyclic DAG — all steps marked blocked', async () => {
    const workflow = makeWorkflow([
      step('a', { needs: ['b'] }),
      step('b', { needs: ['a'] }),
    ]);
    const issue = makeIssue({ step: 'a' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(result.evaluations).toHaveLength(2);
    expect(result.evaluations.every((e) => e.resolution === 'blocked')).toBe(true);
    expect(result.current_step).toBeNull();
    expect(result.status).toBe('blocked');
  });

  test('paused in skip_when — step marked paused, not skipped', async () => {
    const workflow = makeWorkflow([
      step('gate', { skip_when: "confirm('Skip this step?')" }),
    ]);
    const issue = makeIssue({ step: 'gate' });
    const ctx = emptyContext();

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, interactiveEvaluator);

    const evalGate = findEval(result, 'gate')!;
    expect(evalGate.resolution).toBe('paused');
    expect(evalGate.action).toBeDefined();
  });

  test('blocked status derived when any step is blocked', async () => {
    const workflow = makeWorkflow([
      step('a', { done_when: 'artifacts.all_present' }),
      step('b', { needs: ['a'], block_when: "issue.status == 'blocked'" }),
    ]);
    const issue = makeIssue({ step: 'b', status: 'blocked' });
    const ctx = emptyContext({
      artifacts: { all_present: true, exists: () => true },
      issue: {
        issue: 'test',
        type: 'feature',
        workflow_id: 'test-workflow',
        step: 'b',
        status: 'blocked',
        tasks_done: 0,
        tasks_total: null,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(findEval(result, 'a')!.resolution).toBe('done');
    expect(findEval(result, 'b')!.resolution).toBe('blocked');
    expect(result.status).toBe('blocked');
  });

  test('current_step is the first ready step when no step is active', async () => {
    const workflow = makeWorkflow([
      step('a', { done_when: 'artifacts.all_present' }),
      step('b', { needs: ['a'] }),
      step('c', { needs: ['a'] }),
    ]);
    // issue.step doesn't match any step in the workflow
    const issue = makeIssue({ step: 'nonexistent' });
    const ctx = emptyContext({
      artifacts: { all_present: true, exists: () => true },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(findEval(result, 'a')!.resolution).toBe('done');
    // b and c are both ready (parallel in the DAG); current_step is the first
    // in topological order (alphabetical tiebreak from resolveDag)
    expect(findEval(result, 'b')!.resolution).toBe('ready');
    expect(findEval(result, 'c')!.resolution).toBe('ready');
    expect(result.current_step).toBe('b');
  });

  test('done_when with tasks.all_done', async () => {
    const workflow = makeWorkflow([
      step('build', { done_when: 'tasks.all_done' }),
    ]);
    const issue = makeIssue({ step: 'build' });
    const ctx = emptyContext({
      tasks: { all_done: true, done_count: 5, total_count: 5 },
    });

    const result = await evaluateSteps(nullDb, workflow, issue, ctx, evaluator);

    expect(findEval(result, 'build')!.resolution).toBe('done');
    expect(result.status).toBe('done');
  });
});
