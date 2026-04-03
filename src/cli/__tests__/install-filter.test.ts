// src/cli/__tests__/install-filter.test.ts
//
// TDD for filtering skills that need step-binding suggestions.
// Skills with suggested_step_binding !== null are already configured.

import { describe, test, expect } from 'vitest';
import { filterUnboundSkills } from '../commands/install-filter.js';

describe('filterUnboundSkills', () => {
  test('returns all skills when manifest is empty', () => {
    const installed = [
      { package: '@pkg/skills', skill: 'tdd', path: '/path/tdd/SKILL.md' },
      { package: '@pkg/skills', skill: 'prd', path: '/path/prd/SKILL.md' },
    ];

    const result = filterUnboundSkills(installed, {});
    expect(result).toHaveLength(2);
  });

  test('returns all skills when manifest has no step bindings', () => {
    const installed = [
      { package: '@pkg/skills', skill: 'tdd', path: '/path/tdd/SKILL.md' },
    ];
    const manifest = {
      '@pkg/skills': {
        skills: {
          tdd: {
            description: 'TDD skill',
            detected_outputs: [],
            suggested_overrides: { omit: [], directives: [] },
            suggested_step_binding: null,
          },
        },
      },
    };

    const result = filterUnboundSkills(installed, manifest);
    expect(result).toHaveLength(1);
  });

  test('filters out skills that already have a step binding', () => {
    const installed = [
      { package: '@pkg/skills', skill: 'tdd', path: '/path/tdd/SKILL.md' },
      { package: '@pkg/skills', skill: 'prd', path: '/path/prd/SKILL.md' },
      { package: '@pkg/skills', skill: 'grill', path: '/path/grill/SKILL.md' },
    ];
    const manifest = {
      '@pkg/skills': {
        skills: {
          tdd: {
            suggested_step_binding: { step: 'build', type: 'step_skills' },
          },
          prd: {
            suggested_step_binding: null,
          },
          grill: {
            suggested_step_binding: { step: 'plan', type: 'step_review_skills' },
          },
        },
      },
    };

    const result = filterUnboundSkills(installed, manifest);
    expect(result).toHaveLength(1);
    expect(result[0].skill).toBe('prd');
  });

  test('includes skills not in manifest at all (newly installed)', () => {
    const installed = [
      { package: '@pkg/skills', skill: 'tdd', path: '/path/tdd/SKILL.md' },
      { package: '@pkg/skills', skill: 'new-skill', path: '/path/new-skill/SKILL.md' },
    ];
    const manifest = {
      '@pkg/skills': {
        skills: {
          tdd: {
            suggested_step_binding: { step: 'build', type: 'step_skills' },
          },
        },
      },
    };

    const result = filterUnboundSkills(installed, manifest);
    expect(result).toHaveLength(1);
    expect(result[0].skill).toBe('new-skill');
  });
});
