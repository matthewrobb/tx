// src/migration/__tests__/runner.test.ts
//
// Behavioral tests for workflow migration: declarative rules, dry-run preview,
// and validation. All tests use createInMemoryStorageAdapter() — no file I/O.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import { createIssue, listIssues, updateIssue, getIssueBySlug } from '../../issues/crud.js';
import { applyMigration, previewMigration } from '../runner.js';
import { validateMigrationPlan } from '../rules.js';
import type { MigrationPlan } from '../rules.js';
import type { WorkflowConfig } from '../../types/config.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function featureInput(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: `Issue ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
    ...overrides,
  };
}

/** First-step resolver for tests — matches DEFAULT_CONFIG's feature workflow. */
function testFirstStepResolver(workflowId: string): string | undefined {
  const workflows: Record<string, string> = {
    feature: 'research',
    'feature-v2': 'discovery',
    bug: 'reproduce',
    chore: 'do',
    spike: 'research',
  };
  return workflows[workflowId];
}

// ── Setup ────────────────────────────────────────────────────────────────

let db: PGLiteStorageAdapter;

beforeEach(async () => {
  db = await createInMemoryStorageAdapter();
});

// ── 1. rename_step — issue on old step moves to new step ─────────────────

describe('rename_step', () => {
  it('moves issue from old step to new step', async () => {
    await createIssue(db, featureInput('feat-rename'));

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Rename research to discovery',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    expect(result.migrated).toBe(1);
    expect(result.errors).toHaveLength(0);

    const issue = await getIssueBySlug(db, 'feat-rename');
    expect(issue!.step).toBe('discovery');
  });

  // ── 2. rename_step — issue on unrelated step not affected ──────────────

  it('does not affect issues on unrelated steps', async () => {
    const issue = await createIssue(db, featureInput('feat-unrelated'));
    // Move issue to 'scope' step so it won't match the 'research' rename
    await updateIssue(db, issue.id, { step: 'scope' });

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Rename research to discovery',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    // No rule matched 'scope', so it ends up in errors (not migrated)
    expect(result.migrated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('feat-unrelated');
    expect(result.errors[0]).toContain('scope');

    const after = await getIssueBySlug(db, 'feat-unrelated');
    expect(after!.step).toBe('scope');
  });
});

// ── 3. remove_step — issue redirected to redirect_to step ────────────────

describe('remove_step', () => {
  it('redirects issue on removed step to redirect_to', async () => {
    await createIssue(db, featureInput('feat-remove'));

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Remove research, redirect to scope',
      rules: [{ kind: 'remove_step', step: 'research', redirect_to: 'scope' }],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    expect(result.migrated).toBe(1);

    const issue = await getIssueBySlug(db, 'feat-remove');
    expect(issue!.step).toBe('scope');
  });
});

// ── 4. reset_to_start — all open issues on workflow reset to first step ──

describe('reset_to_start', () => {
  it('resets all open issues to the first step of the workflow', async () => {
    const a = await createIssue(db, featureInput('feat-reset-a'));
    const b = await createIssue(db, featureInput('feat-reset-b'));

    // Move one issue to a later step
    await updateIssue(db, a.id, { step: 'scope' });
    await updateIssue(db, b.id, { step: 'build' });

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Reset all feature issues to start',
      rules: [{ kind: 'reset_to_start', workflow_id: 'feature' }],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    expect(result.migrated).toBe(2);
    expect(result.errors).toHaveLength(0);

    const afterA = await getIssueBySlug(db, 'feat-reset-a');
    const afterB = await getIssueBySlug(db, 'feat-reset-b');
    expect(afterA!.step).toBe('research');
    expect(afterB!.step).toBe('research');
  });
});

// ── 5. reassign_workflow — issues move to new workflow with remapped steps ─

describe('reassign_workflow', () => {
  it('moves issues to new workflow with remapped steps', async () => {
    await createIssue(db, featureInput('feat-reassign'));

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Move feature issues to feature-v2 workflow',
      rules: [
        {
          kind: 'reassign_workflow',
          from_workflow: 'feature',
          to_workflow: 'feature-v2',
          step_map: {
            research: 'discovery',
            scope: 'define',
            plan: 'design',
            build: 'implement',
          },
        },
      ],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    expect(result.migrated).toBe(1);

    const issue = await getIssueBySlug(db, 'feat-reassign');
    expect(issue!.workflow_id).toBe('feature-v2');
    expect(issue!.step).toBe('discovery');
  });
});

// ── 6. Done/archived issues skipped (not migrated) ──────────────────────

describe('done/archived issue skipping', () => {
  it('skips done and archived issues', async () => {
    const done = await createIssue(db, featureInput('feat-done'));
    const archived = await createIssue(db, featureInput('feat-archived'));
    await createIssue(db, featureInput('feat-open'));

    await updateIssue(db, done.id, { status: 'done' });
    await updateIssue(db, archived.id, { status: 'archived' });

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Rename research to discovery',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
    };

    const result = await applyMigration(db, plan, testFirstStepResolver);

    expect(result.migrated).toBe(1);
    expect(result.skipped).toBe(2);

    // Verify done/archived issues were NOT changed
    const doneAfter = await getIssueBySlug(db, 'feat-done');
    const archivedAfter = await getIssueBySlug(db, 'feat-archived');
    expect(doneAfter!.step).toBe('research');
    expect(archivedAfter!.step).toBe('research');

    // Verify open issue WAS changed
    const openAfter = await getIssueBySlug(db, 'feat-open');
    expect(openAfter!.step).toBe('discovery');
  });
});

// ── 7. previewMigration — returns preview without modifying DB ───────────

describe('previewMigration', () => {
  it('returns preview entries without modifying the database', async () => {
    await createIssue(db, featureInput('feat-preview-a'));
    const b = await createIssue(db, featureInput('feat-preview-b'));
    await updateIssue(db, b.id, { step: 'scope' });

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Rename research to discovery',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
    };

    const preview = await previewMigration(db, plan, testFirstStepResolver);

    // Only feat-preview-a should be in the preview (it's on 'research')
    expect(preview).toHaveLength(1);
    expect(preview[0]).toEqual({
      issue_slug: 'feat-preview-a',
      from_step: 'research',
      to_step: 'discovery',
    });

    // Verify the DB was NOT modified
    const afterA = await getIssueBySlug(db, 'feat-preview-a');
    expect(afterA!.step).toBe('research');
  });
});

// ── 8. validateMigrationPlan — detects invalid redirect target ───────────

describe('validateMigrationPlan', () => {
  const oldWorkflow: WorkflowConfig = {
    id: 'feature',
    steps: [
      { id: 'research', title: 'Research', needs: [] },
      { id: 'scope', title: 'Scope', needs: ['research'] },
      { id: 'plan', title: 'Plan', needs: ['scope'] },
      { id: 'build', title: 'Build', needs: ['plan'] },
    ],
  };

  const newWorkflow: WorkflowConfig = {
    id: 'feature',
    steps: [
      { id: 'discovery', title: 'Discovery', needs: [] },
      { id: 'define', title: 'Define', needs: ['discovery'] },
      { id: 'build', title: 'Build', needs: ['define'] },
    ],
  };

  it('detects invalid redirect target in remove_step', () => {
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Remove research, redirect to nonexistent step',
      rules: [
        { kind: 'remove_step', step: 'research', redirect_to: 'nonexistent' },
      ],
    };

    const result = validateMigrationPlan(plan, oldWorkflow, newWorkflow);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('nonexistent');
      expect(result.errors[0]).toContain('does not exist');
    }
  });

  it('detects invalid rename target', () => {
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Rename to nonexistent step',
      rules: [{ kind: 'rename_step', from: 'research', to: 'ghost' }],
    };

    const result = validateMigrationPlan(plan, oldWorkflow, newWorkflow);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('ghost');
    }
  });

  it('detects incomplete step_map in reassign_workflow', () => {
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Incomplete step_map',
      rules: [
        {
          kind: 'reassign_workflow',
          from_workflow: 'feature',
          to_workflow: 'feature-v2',
          step_map: {
            research: 'discovery',
            // Missing scope, plan, build
          },
        },
      ],
    };

    const result = validateMigrationPlan(plan, oldWorkflow, newWorkflow);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      // Should mention the missing steps
      const allErrors = result.errors.join(' ');
      expect(allErrors).toContain('scope');
      expect(allErrors).toContain('plan');
      expect(allErrors).toContain('build');
    }
  });

  it('passes for a valid plan', () => {
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      description: 'Valid rename',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
    };

    const result = validateMigrationPlan(plan, oldWorkflow, newWorkflow);
    expect(result.ok).toBe(true);
  });
});
