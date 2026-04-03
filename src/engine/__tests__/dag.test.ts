import { describe, test, expect } from 'vitest';
import { resolveDag } from '../dag.js';
import type { StepDef } from '../../types/workflow.js';

/** Helper: sort each inner array for deterministic group comparison. */
function sortGroups(groups: string[][]): string[][] {
  return groups.map((g) => [...g].sort());
}

describe('resolveDag', () => {
  test('1. empty workflow — zero steps', () => {
    const result = resolveDag([]);
    expect(result).toEqual({ ok: true, order: [], groups: [] });
  });

  test('2. single step, no deps', () => {
    const steps: StepDef[] = [{ id: 'A', needs: [] }];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order).toEqual(['A']);
    expect(result.groups).toEqual([['A']]);
  });

  test('3. linear chain A -> B -> C', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'B', needs: ['A'] },
      { id: 'C', needs: ['B'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order).toEqual(['A', 'B', 'C']);
    expect(result.groups).toEqual([['A'], ['B'], ['C']]);
  });

  test('4. diamond: A->[], B->[A], C->[A], D->[B,C]', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'B', needs: ['A'] },
      { id: 'C', needs: ['A'] },
      { id: 'D', needs: ['B', 'C'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Order must have A first, D last, B and C in between.
    expect(result.order[0]).toBe('A');
    expect(result.order[3]).toBe('D');
    expect(new Set(result.order.slice(1, 3))).toEqual(new Set(['B', 'C']));

    expect(sortGroups(result.groups)).toEqual([
      ['A'],
      ['B', 'C'],
      ['D'],
    ]);
  });

  test('5. wide parallel: A->[], B->[], C->[], D->[A,B,C]', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'B', needs: [] },
      { id: 'C', needs: [] },
      { id: 'D', needs: ['A', 'B', 'C'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // D must be last, A/B/C in first group.
    expect(result.order[3]).toBe('D');
    expect(new Set(result.order.slice(0, 3))).toEqual(new Set(['A', 'B', 'C']));

    expect(sortGroups(result.groups)).toEqual([
      ['A', 'B', 'C'],
      ['D'],
    ]);
  });

  test('6. simple cycle: A->[B], B->[A]', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: ['B'] },
      { id: 'B', needs: ['A'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Both A and B should appear in the reported cycles.
    const allCycleNodes = result.cycles.flat();
    expect(allCycleNodes).toContain('A');
    expect(allCycleNodes).toContain('B');
  });

  test('7. self-loop: A->[A]', () => {
    const steps: StepDef[] = [{ id: 'A', needs: ['A'] }];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const allCycleNodes = result.cycles.flat();
    expect(allCycleNodes).toContain('A');
  });

  test('8. unknown dependency: step references non-existent ID', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'B', needs: ['A', 'GHOST'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // The error should mention both the referencing step and the unknown dep.
    const allNodes = result.cycles.flat();
    expect(allNodes).toContain('B');
    expect(allNodes).toContain('GHOST');
  });

  test('9. duplicate IDs', () => {
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'A', needs: [] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const allNodes = result.cycles.flat();
    expect(allNodes).toContain('A');
  });

  test('10. complex real-world workflow with 8+ steps', () => {
    // Simulates a realistic CI/CD-like workflow:
    //
    //   lint ──────────┐
    //   typecheck ─────┤
    //                  ├──> unit-test ──┐
    //   build ─────────┤               │
    //                  │               ├──> integration-test ──┐
    //   db-migrate ────┘               │                      │
    //                                  │                      ├──> deploy
    //   e2e-setup ─────────────────────┘                      │
    //                                                         │
    //   docs ─────────────────────────────────────────────────┘
    //
    const steps: StepDef[] = [
      { id: 'lint', needs: [] },
      { id: 'typecheck', needs: [] },
      { id: 'build', needs: [] },
      { id: 'db-migrate', needs: [] },
      { id: 'e2e-setup', needs: [] },
      { id: 'docs', needs: [] },
      { id: 'unit-test', needs: ['lint', 'typecheck', 'build', 'db-migrate'] },
      { id: 'integration-test', needs: ['unit-test', 'e2e-setup'] },
      { id: 'deploy', needs: ['integration-test', 'docs'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Verify total ordering properties.
    expect(result.order).toHaveLength(9);

    // deploy must come after integration-test.
    const deployIdx = result.order.indexOf('deploy');
    const integIdx = result.order.indexOf('integration-test');
    const unitIdx = result.order.indexOf('unit-test');
    expect(deployIdx).toBeGreaterThan(integIdx);
    expect(integIdx).toBeGreaterThan(unitIdx);

    // Verify parallel groups.
    expect(sortGroups(result.groups)).toEqual([
      // Group 0: all zero-dep steps.
      ['build', 'db-migrate', 'docs', 'e2e-setup', 'lint', 'typecheck'],
      // Group 1: unit-test (all its deps are in group 0).
      ['unit-test'],
      // Group 2: integration-test (depends on unit-test + e2e-setup).
      ['integration-test'],
      // Group 3: deploy (depends on integration-test + docs).
      ['deploy'],
    ]);
  });

  test('input order does not affect correctness', () => {
    // Reverse order of the linear chain — should still resolve correctly.
    const steps: StepDef[] = [
      { id: 'C', needs: ['B'] },
      { id: 'B', needs: ['A'] },
      { id: 'A', needs: [] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order).toEqual(['A', 'B', 'C']);
    expect(result.groups).toEqual([['A'], ['B'], ['C']]);
  });

  test('cycle with tail: valid prefix + cycle', () => {
    // A -> B -> C -> D -> B (cycle among B, C, D; A is valid)
    const steps: StepDef[] = [
      { id: 'A', needs: [] },
      { id: 'B', needs: ['A', 'D'] },
      { id: 'C', needs: ['B'] },
      { id: 'D', needs: ['C'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // B, C, D are in a cycle. A is not.
    const allCycleNodes = result.cycles.flat();
    expect(allCycleNodes).toContain('B');
    expect(allCycleNodes).toContain('C');
    expect(allCycleNodes).toContain('D');
    expect(allCycleNodes).not.toContain('A');
  });

  test('multiple independent cycles', () => {
    // Two separate cycles: A<->B and C<->D
    const steps: StepDef[] = [
      { id: 'A', needs: ['B'] },
      { id: 'B', needs: ['A'] },
      { id: 'C', needs: ['D'] },
      { id: 'D', needs: ['C'] },
    ];
    const result = resolveDag(steps);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Should detect both cycles.
    const allCycleNodes = result.cycles.flat();
    expect(allCycleNodes).toContain('A');
    expect(allCycleNodes).toContain('B');
    expect(allCycleNodes).toContain('C');
    expect(allCycleNodes).toContain('D');

    // Should report as separate cycles (at least 2 entries).
    expect(result.cycles.length).toBeGreaterThanOrEqual(2);
  });
});
