import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../resolve.js';
import { DEFAULT_CONFIG } from '../defaults.js';
import type { TwistedSettings } from '../../types/config.js';

describe('resolveConfig', () => {
  // -----------------------------------------------------------------------
  // 1. No settings → returns DEFAULT_CONFIG
  // -----------------------------------------------------------------------
  it('returns default config when no settings provided', () => {
    const result = resolveConfig();
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it('returns default config when empty settings provided', () => {
    const result = resolveConfig({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  // -----------------------------------------------------------------------
  // 2. User overrides context_skills
  // -----------------------------------------------------------------------
  it('merges user context_skills override', () => {
    const settings: TwistedSettings = {
      context_skills: ['my-skill', 'another-skill'],
    };

    const result = resolveConfig(settings);
    expect(result.context_skills).toEqual(['my-skill', 'another-skill']);
    // Other fields remain at defaults
    expect(result.version).toBe('4.0');
    expect(result.workflows).toEqual(DEFAULT_CONFIG.workflows);
    expect(result.step_skills).toEqual(DEFAULT_CONFIG.step_skills);
  });

  // -----------------------------------------------------------------------
  // 3. User adds a new workflow
  // -----------------------------------------------------------------------
  it('includes new user workflow alongside built-ins', () => {
    const settings: TwistedSettings = {
      workflows: [
        {
          id: 'custom',
          title: 'Custom Workflow',
          steps: [
            { id: 'init', title: 'Init', needs: [] },
            { id: 'finish', title: 'Finish', needs: ['init'] },
          ],
        },
      ],
    };

    const result = resolveConfig(settings);

    // All built-in workflows should still be present
    const ids = result.workflows.map((w) => w.id);
    expect(ids).toContain('feature');
    expect(ids).toContain('bug');
    expect(ids).toContain('chore');
    expect(ids).toContain('spike');
    // User workflow appended
    expect(ids).toContain('custom');

    const custom = result.workflows.find((w) => w.id === 'custom');
    expect(custom).toBeDefined();
    expect(custom!.steps).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // 4. User overrides existing workflow steps
  // -----------------------------------------------------------------------
  it('overrides built-in workflow steps when user provides same id', () => {
    const settings: TwistedSettings = {
      workflows: [
        {
          id: 'feature',
          steps: [
            { id: 'design', title: 'Design', needs: [] },
            { id: 'implement', title: 'Implement', needs: ['design'] },
            { id: 'test', title: 'Test', needs: ['implement'] },
          ],
        },
      ],
    };

    const result = resolveConfig(settings);

    const feature = result.workflows.find((w) => w.id === 'feature');
    expect(feature).toBeDefined();
    // User steps replace built-in steps entirely
    expect(feature!.steps).toHaveLength(3);
    expect(feature!.steps![0]!.id).toBe('design');
    expect(feature!.steps![1]!.id).toBe('implement');
    expect(feature!.steps![2]!.id).toBe('test');
    // Title inherited from default since user didn't provide it
    expect(feature!.title).toBe('Feature');
  });

  it('preserves built-in workflow title when user only overrides steps', () => {
    const settings: TwistedSettings = {
      workflows: [
        {
          id: 'bug',
          steps: [
            { id: 'triage', title: 'Triage', needs: [] },
            { id: 'fix', title: 'Fix', needs: ['triage'] },
          ],
        },
      ],
    };

    const result = resolveConfig(settings);
    const bug = result.workflows.find((w) => w.id === 'bug');
    expect(bug).toBeDefined();
    expect(bug!.title).toBe('Bug');
    expect(bug!.steps).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it('merges step_skills from user settings', () => {
    const settings: TwistedSettings = {
      step_skills: {
        build: 'my-custom/build-skill',
      },
    };

    const result = resolveConfig(settings);
    expect(result.step_skills['build']).toBe('my-custom/build-skill');
  });

  it('does not duplicate built-in workflows when user adds a new one', () => {
    const settings: TwistedSettings = {
      workflows: [
        { id: 'release', title: 'Release', steps: [] },
      ],
    };

    const result = resolveConfig(settings);
    const ids = result.workflows.map((w) => w.id);
    // Built-ins + the new release workflow
    expect(ids.filter((id) => id === 'feature')).toHaveLength(1);
    expect(ids.filter((id) => id === 'bug')).toHaveLength(1);
    expect(ids.filter((id) => id === 'chore')).toHaveLength(1);
    expect(ids.filter((id) => id === 'spike')).toHaveLength(1);
    expect(ids).toContain('release');
  });
});
