// src/__tests__/e2e/migration.test.ts
//
// End-to-end migration flow: rename_step, reset_to_start, previewMigration,
// and verifying done/archived issues are unaffected.

import { describe, test, expect, beforeEach } from 'vitest';
import { createInMemoryStorageAdapter } from '../../adapters/pglite/index.js';
import type { PGLiteStorageAdapter } from '../../adapters/pglite/adapter.js';
import {
  createIssue,
  getIssueBySlug,
  closeIssue,
  archiveIssue,
  updateIssue,
} from '../../issues/crud.js';
import { applyMigration, previewMigration } from '../../migration/runner.js';
import type { MigrationPlan } from '../../migration/rules.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function featureInput(slug: string) {
  return {
    slug,
    title: `Feature ${slug}`,
    type: 'feature' as const,
    workflow_id: 'feature',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('migration E2E', () => {
  let db: PGLiteStorageAdapter;

  beforeEach(async () => {
    db = await createInMemoryStorageAdapter();
  });

  // 1. rename_step migrates open issues to new step name
  test('rename_step migrates open issues to new step name', async () => {
    // Create issues on 'research' step
    await createIssue(db, featureInput('rename-a'));
    await createIssue(db, featureInput('rename-b'));

    // Create one done issue — should not be affected
    await createIssue(db, featureInput('rename-done'));
    await closeIssue(db, 'rename-done');

    // Verify starting step
    const before = await getIssueBySlug(db, 'rename-a');
    expect(before!.step).toBe('research');

    // Apply rename migration: research -> discovery
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
      description: 'Rename research to discovery',
    };

    const result = await applyMigration(db, plan);

    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(1); // done issue skipped
    expect(result.errors).toHaveLength(0);

    // Verify open issues now on 'discovery'
    const afterA = await getIssueBySlug(db, 'rename-a');
    expect(afterA!.step).toBe('discovery');
    const afterB = await getIssueBySlug(db, 'rename-b');
    expect(afterB!.step).toBe('discovery');

    // Done issue not affected
    const afterDone = await getIssueBySlug(db, 'rename-done');
    expect(afterDone!.step).toBe('research');
  });

  // 2. previewMigration shows changes without modifying DB
  test('previewMigration shows changes without modifying DB', async () => {
    await createIssue(db, featureInput('preview-a'));
    await createIssue(db, featureInput('preview-b'));

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'rename_step', from: 'research', to: 'exploration' }],
      description: 'Preview rename research to exploration',
    };

    const preview = await previewMigration(db, plan);

    // Preview returns the expected changes
    expect(preview).toHaveLength(2);
    expect(preview[0]!.from_step).toBe('research');
    expect(preview[0]!.to_step).toBe('exploration');
    expect(preview[1]!.from_step).toBe('research');
    expect(preview[1]!.to_step).toBe('exploration');

    // DB is unchanged
    const afterA = await getIssueBySlug(db, 'preview-a');
    expect(afterA!.step).toBe('research');
    const afterB = await getIssueBySlug(db, 'preview-b');
    expect(afterB!.step).toBe('research');
  });

  // 3. reset_to_start resets all open issues on workflow
  test('reset_to_start resets all open issues on workflow', async () => {
    // Create issues on various steps
    const issueA = await createIssue(db, featureInput('reset-a'));
    const issueB = await createIssue(db, featureInput('reset-b'));

    // Advance issueA to 'scope' manually
    await updateIssue(db, issueA.id, { step: 'scope' });

    // Advance issueB to 'build' manually
    await updateIssue(db, issueB.id, { step: 'build' });

    // Create an archived issue — should not be affected
    await createIssue(db, featureInput('reset-archived'));
    await archiveIssue(db, 'reset-archived');

    // Verify starting state
    const beforeA = await getIssueBySlug(db, 'reset-a');
    expect(beforeA!.step).toBe('scope');
    const beforeB = await getIssueBySlug(db, 'reset-b');
    expect(beforeB!.step).toBe('build');

    // Apply reset_to_start
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'reset_to_start', workflow_id: 'feature' }],
      description: 'Reset all open feature issues to start',
    };

    const result = await applyMigration(db, plan);

    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(1); // archived issue skipped
    expect(result.errors).toHaveLength(0);

    // All open issues are now on the first step (research)
    const afterA = await getIssueBySlug(db, 'reset-a');
    expect(afterA!.step).toBe('research');
    const afterB = await getIssueBySlug(db, 'reset-b');
    expect(afterB!.step).toBe('research');

    // Archived issue not affected
    const afterArchived = await getIssueBySlug(db, 'reset-archived');
    expect(afterArchived!.step).toBe('research'); // original step, but status is archived
    expect(afterArchived!.status).toBe('archived');
  });

  // 4. remove_step redirects issues on the removed step
  test('remove_step redirects issues to the specified step', async () => {
    const issue = await createIssue(db, featureInput('remove-target'));
    expect(issue.step).toBe('research');

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'remove_step', step: 'research', redirect_to: 'scope' }],
      description: 'Remove research step, redirect to scope',
    };

    const result = await applyMigration(db, plan);
    expect(result.migrated).toBe(1);

    const after = await getIssueBySlug(db, 'remove-target');
    expect(after!.step).toBe('scope');
  });

  // 5. Migration with no matching rules records errors (non-fatal)
  test('migration with no matching rules records errors', async () => {
    const issue = await createIssue(db, featureInput('no-match'));
    // Issue starts on 'research', but the rename targets 'nonexistent'
    expect(issue.step).toBe('research');

    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'rename_step', from: 'nonexistent', to: 'something' }],
      description: 'Rename a step that no issue is on',
    };

    const result = await applyMigration(db, plan);

    expect(result.migrated).toBe(0);
    // The issue was open on 'research' but no rule matched it
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('no-match');
    expect(result.errors[0]).toContain('research');

    // DB unchanged
    const after = await getIssueBySlug(db, 'no-match');
    expect(after!.step).toBe('research');
  });

  // 6. preview on empty database returns empty array
  test('preview on empty database returns empty', async () => {
    const plan: MigrationPlan = {
      workflow_id: 'feature',
      rules: [{ kind: 'rename_step', from: 'research', to: 'discovery' }],
      description: 'Nothing to migrate',
    };

    const preview = await previewMigration(db, plan);
    expect(preview).toHaveLength(0);
  });
});
