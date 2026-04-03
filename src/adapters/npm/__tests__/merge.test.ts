// src/adapters/npm/__tests__/merge.test.ts — unit tests for mergeWithPackage.
//
// Pure function tests only — no npm calls, no filesystem access.

import { describe, it, expect } from 'vitest';
import { mergeWithPackage } from '../merge.js';
import { DEFAULT_CONFIG } from '../../../config/defaults.js';
import type { TwistedConfig, WorkflowConfig } from '../../../types/config.js';
import type { ResolvedPackage } from '../../../ports/packages.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function makePackage(overrides: Partial<ResolvedPackage['manifest']> = {}): ResolvedPackage {
  return {
    name: 'twisted-skill-test',
    version: '1.0.0',
    installPath: '/fake/path',
    manifest: {
      name: 'twisted-skill-test',
      version: '1.0.0',
      skills: [],
      personas: [],
      workflows: [],
      ...overrides,
    },
  };
}

// A minimal base config for tests that don't need the full DEFAULT_CONFIG.
const BASE: TwistedConfig = { ...DEFAULT_CONFIG };

// ── Tests ─────────────────────────────────────────────────────────────────

describe('mergeWithPackage', () => {
  // -------------------------------------------------------------------------
  // 1. Package with no workflows → base config unchanged
  // -------------------------------------------------------------------------
  it('returns base config unchanged when package has no workflows', () => {
    const pkg = makePackage({ workflows: [] });
    const result = mergeWithPackage(BASE, pkg);

    expect(result.workflows).toEqual(BASE.workflows);
    expect(result.context_skills).toEqual(BASE.context_skills);
    expect(result.step_skills).toEqual(BASE.step_skills);
  });

  // -------------------------------------------------------------------------
  // 2. Package adds a new workflow → workflow appears in merged config
  // -------------------------------------------------------------------------
  it('appends package workflows to the base workflow list', () => {
    const customWorkflow: WorkflowConfig = {
      id: 'review',
      title: 'Code Review',
      steps: [
        { id: 'analyse', title: 'Analyse', needs: [] },
        { id: 'comment', title: 'Comment', needs: ['analyse'] },
      ],
    };

    const pkg = makePackage({ workflows: [customWorkflow] });
    const result = mergeWithPackage(BASE, pkg);

    const ids = result.workflows.map((w) => w.id);
    // All built-in workflows still present
    expect(ids).toContain('feature');
    expect(ids).toContain('bug');
    expect(ids).toContain('chore');
    expect(ids).toContain('spike');
    // Package workflow appended
    expect(ids).toContain('review');

    const review = result.workflows.find((w) => w.id === 'review');
    expect(review).toBeDefined();
    expect(review!.steps).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // 3. User override for a workflow → user's version wins over package's
  // -------------------------------------------------------------------------
  it("user workflow override wins over package's workflow with same id", () => {
    const packageWorkflow: WorkflowConfig = {
      id: 'review',
      title: 'Code Review (pkg)',
      steps: [{ id: 'read', title: 'Read', needs: [] }],
    };

    const userWorkflow: WorkflowConfig = {
      id: 'review',
      title: 'Code Review (user)',
      steps: [
        { id: 'read', title: 'Read', needs: [] },
        { id: 'approve', title: 'Approve', needs: ['read'] },
      ],
    };

    const pkg = makePackage({ workflows: [packageWorkflow] });
    const result = mergeWithPackage(BASE, pkg, { workflows: [userWorkflow] });

    const review = result.workflows.find((w) => w.id === 'review');
    expect(review).toBeDefined();
    // User title wins
    expect(review!.title).toBe('Code Review (user)');
    // User steps win (2 steps, not 1)
    expect(review!.steps).toHaveLength(2);

    // Exactly one 'review' entry — no duplicates
    const reviewCount = result.workflows.filter((w) => w.id === 'review').length;
    expect(reviewCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 4. User override for `context_skills` → merged correctly
  // -------------------------------------------------------------------------
  it('applies user context_skills override on top of package+base', () => {
    const pkg = makePackage();
    const result = mergeWithPackage(BASE, pkg, {
      context_skills: ['my-skill', 'another-skill'],
    });

    expect(result.context_skills).toEqual(['my-skill', 'another-skill']);
    // Other scalar fields unaffected
    expect(result.version).toBe('4.0');
    expect(result.step_skills).toEqual(BASE.step_skills);
  });

  // -------------------------------------------------------------------------
  // 5. Empty package manifest (no `twisted` field) → base unchanged
  // -------------------------------------------------------------------------
  it('leaves base config unchanged for a package with empty manifest fields', () => {
    // Simulate a package where twisted.workflows and twisted.skills are absent
    // (e.g. the package.json had no `twisted` field at all — resolver sets []).
    const pkg = makePackage({
      skills: [],
      personas: [],
      workflows: [],
      entry: undefined,
      description: undefined,
    });

    const result = mergeWithPackage(BASE, pkg);

    expect(result.workflows).toEqual(BASE.workflows);
    expect(result.context_skills).toEqual(BASE.context_skills);
    expect(result.step_skills).toEqual(BASE.step_skills);
    expect(result.step_review_skills).toEqual(BASE.step_review_skills);
  });
});
