import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { generateMachine } from '../generator.js';
import type { Workflow, WorkflowId } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal workflow factory — reduces boilerplate in test cases. */
function makeWorkflow(
  slug: string,
  steps: Array<{ id: string; title?: string; needs?: string[] }>,
): Workflow {
  return {
    id: `wf-${slug}` as WorkflowId,
    slug,
    title: slug,
    steps: steps.map((s) => ({
      id: s.id,
      title: s.title ?? s.id,
      needs: s.needs ?? [],
    })),
  };
}

/** Snapshot helper — returns context from a running actor. */
function ctx(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().context;
}

/** State value helper — returns the current state name. */
function state(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().value;
}

// ---------------------------------------------------------------------------
// Workflows used across tests
// ---------------------------------------------------------------------------

/**
 * Linear 3-step workflow: research → scope → build
 *
 *   research ──► scope ──► build
 */
const linearWorkflow = makeWorkflow('linear', [
  { id: 'research' },
  { id: 'scope', needs: ['research'] },
  { id: 'build', needs: ['scope'] },
]);

/**
 * Diamond workflow: A → B, A → C, D depends on B + C
 *
 *        ┌── B ──┐
 *   A ───┤       ├──► D
 *        └── C ──┘
 */
const diamondWorkflow = makeWorkflow('diamond', [
  { id: 'A' },
  { id: 'B', needs: ['A'] },
  { id: 'C', needs: ['A'] },
  { id: 'D', needs: ['B', 'C'] },
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateMachine', () => {
  // ---- 1. Initial state ---------------------------------------------------

  it('starts with the first step as current, empty completed_steps, status open', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    expect(ctx(actor).current_step).toBe('research');
    expect(ctx(actor).completed_steps).toEqual([]);
    expect(ctx(actor).status).toBe('open');
    expect(state(actor)).toBe('active');
  });

  // ---- 2. Linear advance --------------------------------------------------

  it('advances linearly through steps on STEP_DONE', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    actor.send({ type: 'STEP_DONE', step: 'research' });
    expect(ctx(actor).current_step).toBe('scope');
    expect(ctx(actor).completed_steps).toEqual(['research']);
    expect(ctx(actor).status).toBe('open');

    actor.send({ type: 'STEP_DONE', step: 'scope' });
    expect(ctx(actor).current_step).toBe('build');
    expect(ctx(actor).completed_steps).toEqual(['research', 'scope']);
    expect(ctx(actor).status).toBe('open');

    actor.send({ type: 'STEP_DONE', step: 'build' });
    expect(ctx(actor).current_step).toBe('build');
    expect(ctx(actor).completed_steps).toEqual(['research', 'scope', 'build']);
    expect(ctx(actor).status).toBe('done');
  });

  // ---- 3. Skip behaves like done ------------------------------------------

  it('advances on STEP_SKIP the same as STEP_DONE', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    actor.send({ type: 'STEP_SKIP', step: 'research' });
    expect(ctx(actor).current_step).toBe('scope');
    expect(ctx(actor).completed_steps).toEqual(['research']);

    actor.send({ type: 'STEP_SKIP', step: 'scope' });
    expect(ctx(actor).current_step).toBe('build');

    actor.send({ type: 'STEP_DONE', step: 'build' });
    expect(ctx(actor).status).toBe('done');
  });

  // ---- 4. Diamond join ----------------------------------------------------

  it('handles diamond dependencies — D only activates when both B and C are done', () => {
    const machine = generateMachine(diamondWorkflow);
    const actor = createActor(machine).start();

    // Initial: A is the only root
    expect(ctx(actor).current_step).toBe('A');

    // Complete A — next should be B (first in topo order among B, C)
    actor.send({ type: 'STEP_DONE', step: 'A' });
    expect(ctx(actor).current_step).toBe('B');
    expect(ctx(actor).completed_steps).toEqual(['A']);

    // Complete B — D is not ready yet (C still needed), so next is C
    actor.send({ type: 'STEP_DONE', step: 'B' });
    expect(ctx(actor).current_step).toBe('C');
    expect(ctx(actor).completed_steps).toEqual(['A', 'B']);

    // Complete C — now D's dependencies (B, C) are all satisfied
    actor.send({ type: 'STEP_DONE', step: 'C' });
    expect(ctx(actor).current_step).toBe('D');
    expect(ctx(actor).completed_steps).toEqual(['A', 'B', 'C']);

    // Complete D — done
    actor.send({ type: 'STEP_DONE', step: 'D' });
    expect(ctx(actor).status).toBe('done');
    expect(ctx(actor).completed_steps).toEqual(['A', 'B', 'C', 'D']);
  });

  // ---- 5. Blocked step ----------------------------------------------------

  it('marks issue as blocked on STEP_BLOCK, and unblocks on STEP_DONE', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    // Block the first step
    actor.send({ type: 'STEP_BLOCK', step: 'research' });
    expect(ctx(actor).status).toBe('blocked');
    expect(state(actor)).toBe('blocked');
    // current_step stays the same
    expect(ctx(actor).current_step).toBe('research');

    // Completing the blocked step unblocks and advances
    actor.send({ type: 'STEP_DONE', step: 'research' });
    expect(ctx(actor).status).toBe('open');
    expect(state(actor)).toBe('active');
    expect(ctx(actor).current_step).toBe('scope');
  });

  // ---- 6. Completion sets status to done ----------------------------------

  it('sets status to done after all steps complete', () => {
    const workflow = makeWorkflow('single', [{ id: 'only' }]);
    const machine = generateMachine(workflow);
    const actor = createActor(machine).start();

    expect(ctx(actor).current_step).toBe('only');
    actor.send({ type: 'STEP_DONE', step: 'only' });
    expect(ctx(actor).status).toBe('done');
    expect(ctx(actor).completed_steps).toEqual(['only']);
  });

  // ---- 7. Invalid transition — wrong step ---------------------------------

  it('ignores STEP_DONE for a step that is not the current step', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    // Try to complete 'scope' when current is 'research'
    actor.send({ type: 'STEP_DONE', step: 'scope' });
    expect(ctx(actor).current_step).toBe('research');
    expect(ctx(actor).completed_steps).toEqual([]);
  });

  // ---- Additional edge cases ----------------------------------------------

  it('RESET returns to initial state from any point', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    actor.send({ type: 'STEP_DONE', step: 'research' });
    actor.send({ type: 'STEP_DONE', step: 'scope' });
    expect(ctx(actor).current_step).toBe('build');

    actor.send({ type: 'RESET' });
    expect(ctx(actor).current_step).toBe('research');
    expect(ctx(actor).completed_steps).toEqual([]);
    expect(ctx(actor).status).toBe('open');
  });

  it('RESET from blocked state returns to active + initial', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    actor.send({ type: 'STEP_BLOCK', step: 'research' });
    expect(state(actor)).toBe('blocked');

    actor.send({ type: 'RESET' });
    expect(state(actor)).toBe('active');
    expect(ctx(actor).current_step).toBe('research');
    expect(ctx(actor).completed_steps).toEqual([]);
    expect(ctx(actor).status).toBe('open');
  });

  it('throws on cyclic workflow', () => {
    const cyclic = makeWorkflow('cyclic', [
      { id: 'A', needs: ['B'] },
      { id: 'B', needs: ['A'] },
    ]);

    expect(() => generateMachine(cyclic)).toThrow(/invalid DAG/i);
  });

  it('throws on empty workflow', () => {
    const empty = makeWorkflow('empty', []);
    expect(() => generateMachine(empty)).toThrow(/no steps/i);
  });

  it('ignores STEP_BLOCK for a step that is not current', () => {
    const machine = generateMachine(linearWorkflow);
    const actor = createActor(machine).start();

    actor.send({ type: 'STEP_BLOCK', step: 'scope' });
    expect(ctx(actor).status).toBe('open');
    expect(state(actor)).toBe('active');
  });
});
