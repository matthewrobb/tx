/**
 * XState v5 machine generator — builds a state machine from a Workflow definition.
 *
 * The machine is created once at load time from the workflow's step DAG.
 * It tracks which step an issue is on and enforces valid transitions
 * based on dependency ordering. It does NOT evaluate expressions or
 * query the DB — that responsibility belongs to the evaluator (S-010).
 *
 * Design: Uses a single "active" compound state with guards + assign actions
 * to enforce DAG ordering. Steps advance when STEP_DONE or STEP_SKIP events
 * match the current step. A closure over the resolved DAG determines
 * which step becomes active next (first step whose `needs` are all in
 * `completed_steps`).
 */

import { setup, assign } from 'xstate';
import type { IssueStatus } from '../types/index.js';
import type { Workflow, StepDef } from '../types/index.js';
import { resolveDag } from './dag.js';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type WorkflowEvent =
  | { type: 'STEP_DONE'; step: string }
  | { type: 'STEP_SKIP'; step: string }
  | { type: 'STEP_BLOCK'; step: string }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface WorkflowContext {
  current_step: string;
  completed_steps: string[];
  status: IssueStatus;
}

// ---------------------------------------------------------------------------
// Helpers closed over a specific workflow
// ---------------------------------------------------------------------------

/**
 * Build a map from step id to its `needs` array for O(1) lookup.
 */
function buildNeedsMap(steps: StepDef[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const step of steps) {
    map.set(step.id, step.needs);
  }
  return map;
}

/**
 * Given the set of completed step ids, find the next eligible step from
 * the topological order. A step is eligible when every id in its `needs`
 * is present in `completed`.
 *
 * Returns `undefined` when no more steps are eligible (all done).
 */
function findNextStep(
  order: string[],
  needsMap: Map<string, string[]>,
  completed: Set<string>,
): string | undefined {
  for (const id of order) {
    if (completed.has(id)) continue;
    const needs = needsMap.get(id);
    // Every dependency must be satisfied
    if (needs !== undefined && needs.every((dep) => completed.has(dep))) {
      return id;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Machine generator
// ---------------------------------------------------------------------------

/**
 * Generate an XState v5 machine from a Workflow definition.
 *
 * Throws if the workflow's step DAG contains cycles or is otherwise invalid.
 */
export function generateMachine(workflow: Workflow) {
  const dag = resolveDag(workflow.steps);

  if (!dag.ok) {
    // Decision: throw rather than return an error type. A cyclic workflow
    // is a configuration error — it should be caught at load time, not
    // silently produce a broken machine.
    throw new Error(
      `Workflow "${workflow.id}" has invalid DAG: cycles in [${dag.cycles.map((c) => c.join(', ')).join('; ')}]`,
    );
  }

  const order = dag.order;
  const needsMap = buildNeedsMap(workflow.steps);
  const allStepIds = new Set(order);
  const firstStep = order[0];

  if (firstStep === undefined) {
    throw new Error(`Workflow "${workflow.id}" has no steps`);
  }

  /**
   * Compute the next step after marking `justCompleted` as done.
   * Returns the next step id or `undefined` if all steps are complete.
   */
  function nextStep(completedSteps: string[], justCompleted: string): string | undefined {
    const completed = new Set(completedSteps);
    completed.add(justCompleted);
    return findNextStep(order, needsMap, completed);
  }

  /**
   * Check whether completing `justCompleted` finishes all steps.
   */
  function isLastStep(completedSteps: string[], justCompleted: string): boolean {
    const completed = new Set(completedSteps);
    completed.add(justCompleted);
    return completed.size === allStepIds.size;
  }

  // Guard: the event's step must match the machine's current_step.
  function isCurrentStep({ context, event }: { context: WorkflowContext; event: { step: string } }): boolean {
    return context.current_step === event.step;
  }

  const machine = setup({
    types: {
      context: {} as WorkflowContext,
      events: {} as WorkflowEvent,
    },
    guards: {
      isCurrentStep: ({ context, event }) => {
        // Guard only applies to events that have a `step` field.
        if (!('step' in event)) return false;
        return isCurrentStep({ context, event: event as { step: string } });
      },
    },
    actions: {
      advanceStep: assign(({ context, event }) => {
        const stepEvent = event as { step: string };
        const completed = [...context.completed_steps, stepEvent.step];
        const done = isLastStep(context.completed_steps, stepEvent.step);
        const next = done ? stepEvent.step : nextStep(context.completed_steps, stepEvent.step);

        return {
          completed_steps: completed,
          current_step: next ?? context.current_step,
          status: done ? ('done' as const) : ('open' as const),
        };
      }),
      markBlocked: assign(({ context }) => ({
        status: 'blocked' as IssueStatus,
      })),
      resetMachine: assign(() => ({
        current_step: firstStep,
        completed_steps: [] as string[],
        status: 'open' as IssueStatus,
      })),
    },
  }).createMachine({
    id: `workflow-${workflow.slug}`,
    initial: 'active',
    context: {
      current_step: firstStep,
      completed_steps: [],
      status: 'open' as IssueStatus,
    },
    states: {
      active: {
        on: {
          STEP_DONE: {
            guard: 'isCurrentStep',
            actions: 'advanceStep',
          },
          STEP_SKIP: {
            guard: 'isCurrentStep',
            actions: 'advanceStep',
          },
          STEP_BLOCK: {
            guard: 'isCurrentStep',
            target: 'blocked',
            actions: 'markBlocked',
          },
          RESET: {
            actions: 'resetMachine',
          },
        },
      },
      blocked: {
        on: {
          STEP_DONE: {
            guard: 'isCurrentStep',
            target: 'active',
            actions: 'advanceStep',
          },
          STEP_SKIP: {
            guard: 'isCurrentStep',
            target: 'active',
            actions: 'advanceStep',
          },
          RESET: {
            target: 'active',
            actions: 'resetMachine',
          },
        },
      },
    },
  });

  return machine;
}

export type WorkflowMachine = ReturnType<typeof generateMachine>;
