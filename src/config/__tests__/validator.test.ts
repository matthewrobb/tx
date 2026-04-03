import { describe, it, expect } from 'vitest';
import { validateConfig } from '../validator.js';
import type { TwistedConfig, WorkflowConfig } from '../../types/config.js';
import { DEFAULT_CONFIG } from '../defaults.js';

/**
 * Helper: create a minimal valid config to use as a base for test mutations.
 * Uses structuredClone to avoid cross-test pollution.
 */
function validConfig(): TwistedConfig {
  return structuredClone(DEFAULT_CONFIG);
}

/** Helper: create a minimal workflow for testing. */
function workflow(overrides: Partial<WorkflowConfig> & { id: string }): WorkflowConfig {
  return {
    title: overrides.id,
    steps: [],
    ...overrides,
  };
}

describe('validateConfig', () => {
  // -----------------------------------------------------------------------
  // 1. Valid config
  // -----------------------------------------------------------------------
  it('accepts valid default config and returns branded ValidConfig', () => {
    const result = validateConfig(validConfig());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config._brand).toBe('ValidConfig');
      expect(result.config.version).toBe('4.0');
    }
  });

  // -----------------------------------------------------------------------
  // 2. Wrong version
  // -----------------------------------------------------------------------
  it('rejects wrong version', () => {
    const config = validConfig();
    // Force a wrong version — cast needed since the type literal is '4.0'
    (config as { version: string }).version = '3.0';

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        kind: 'invalid_version',
        found: '3.0',
      });
    }
  });

  // -----------------------------------------------------------------------
  // 3. Duplicate workflow IDs
  // -----------------------------------------------------------------------
  it('detects duplicate workflow IDs', () => {
    const config = validConfig();
    config.workflows.push(workflow({ id: 'feature' }));

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        kind: 'duplicate_workflow_id',
        id: 'feature',
      });
    }
  });

  // -----------------------------------------------------------------------
  // 4. DAG cycle
  // -----------------------------------------------------------------------
  it('detects cycles in step DAG', () => {
    const config = validConfig();
    config.workflows = [
      {
        id: 'cyclic',
        title: 'Cyclic Workflow',
        steps: [
          { id: 'a', title: 'A', needs: ['b'] },
          { id: 'b', title: 'B', needs: ['a'] },
        ],
      },
    ];

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const dagError = result.errors.find((e) => e.kind === 'dag_cycle');
      expect(dagError).toBeDefined();
      if (dagError && dagError.kind === 'dag_cycle') {
        expect(dagError.workflow).toBe('cyclic');
        expect(dagError.cycles.length).toBeGreaterThan(0);
      }
    }
  });

  // -----------------------------------------------------------------------
  // 5. Invalid expression syntax
  // -----------------------------------------------------------------------
  it('detects invalid expression syntax in done_when', () => {
    const config = validConfig();
    config.workflows = [
      {
        id: 'bad-expr',
        title: 'Bad Expressions',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            needs: [],
            done_when: '== invalid syntax ==',
          },
        ],
      },
    ];

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const exprError = result.errors.find((e) => e.kind === 'invalid_expression');
      expect(exprError).toBeDefined();
      if (exprError && exprError.kind === 'invalid_expression') {
        expect(exprError.workflow).toBe('bad-expr');
        expect(exprError.step).toBe('step1');
        expect(exprError.field).toBe('done_when');
        expect(exprError.error).toBeTruthy();
      }
    }
  });

  it('detects invalid expression syntax in skip_when', () => {
    const config = validConfig();
    config.workflows = [
      {
        id: 'bad-skip',
        title: 'Bad Skip',
        steps: [
          {
            id: 's1',
            title: 'S1',
            needs: [],
            skip_when: '(((',
          },
        ],
      },
    ];

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const exprError = result.errors.find((e) => e.kind === 'invalid_expression');
      expect(exprError).toBeDefined();
      if (exprError && exprError.kind === 'invalid_expression') {
        expect(exprError.field).toBe('skip_when');
      }
    }
  });

  it('accepts valid expression syntax', () => {
    const config = validConfig();
    config.workflows = [
      {
        id: 'valid-expr',
        title: 'Valid Expressions',
        steps: [
          {
            id: 'step1',
            title: 'Step 1',
            needs: [],
            done_when: 'artifacts.all_present',
            skip_when: "issue.type == 'chore'",
            block_when: 'not tasks.all_done',
          },
        ],
      },
    ];

    const result = validateConfig(config);
    expect(result.ok).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 6. Unknown extends reference
  // -----------------------------------------------------------------------
  it('detects unknown extends reference', () => {
    const config = validConfig();
    config.workflows.push(
      workflow({ id: 'custom', extends: 'nonexistent' }),
    );

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        kind: 'unknown_extends',
        workflow: 'custom',
        extends_id: 'nonexistent',
      });
    }
  });

  // -----------------------------------------------------------------------
  // 7. Extends chain cycle
  // -----------------------------------------------------------------------
  it('detects extends chain cycle', () => {
    const config: TwistedConfig = {
      version: '4.0',
      workflows: [
        workflow({ id: 'alpha', extends: 'beta' }),
        workflow({ id: 'beta', extends: 'alpha' }),
      ],
      context_skills: [],
      step_skills: {},
      step_review_skills: {},
    };

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const cycleError = result.errors.find((e) => e.kind === 'extends_cycle');
      expect(cycleError).toBeDefined();
      if (cycleError && cycleError.kind === 'extends_cycle') {
        expect(cycleError.chain).toContain('alpha');
        expect(cycleError.chain).toContain('beta');
      }
    }
  });

  // -----------------------------------------------------------------------
  // 8. Multiple errors collected (don't stop at first)
  // -----------------------------------------------------------------------
  it('collects multiple errors without short-circuiting', () => {
    const config: TwistedConfig = {
      version: '4.0',
      workflows: [
        // Duplicate IDs
        workflow({ id: 'dup' }),
        workflow({ id: 'dup' }),
        // Unknown extends
        workflow({ id: 'orphan', extends: 'ghost' }),
        // Cyclic DAG
        {
          id: 'cyclic',
          title: 'Cyclic',
          steps: [
            { id: 'x', title: 'X', needs: ['y'] },
            { id: 'y', title: 'Y', needs: ['x'] },
          ],
        },
        // Invalid expression
        {
          id: 'bad-expr',
          title: 'Bad Expr',
          steps: [
            { id: 'z', title: 'Z', needs: [], done_when: '!!!' },
          ],
        },
      ],
      context_skills: [],
      step_skills: {},
      step_review_skills: {},
    };

    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const kinds = result.errors.map((e) => e.kind);
      expect(kinds).toContain('duplicate_workflow_id');
      expect(kinds).toContain('unknown_extends');
      expect(kinds).toContain('dag_cycle');
      expect(kinds).toContain('invalid_expression');
      // Must have at least 4 distinct errors
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it('accepts workflows with no steps (empty step list)', () => {
    const config: TwistedConfig = {
      version: '4.0',
      workflows: [workflow({ id: 'empty', steps: [] })],
      context_skills: [],
      step_skills: {},
      step_review_skills: {},
    };

    const result = validateConfig(config);
    expect(result.ok).toBe(true);
  });

  it('accepts workflows with undefined steps', () => {
    const config: TwistedConfig = {
      version: '4.0',
      workflows: [{ id: 'no-steps' }],
      context_skills: [],
      step_skills: {},
      step_review_skills: {},
    };

    const result = validateConfig(config);
    expect(result.ok).toBe(true);
  });
});
