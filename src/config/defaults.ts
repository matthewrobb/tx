/**
 * Built-in default TwistedConfig — every field present.
 *
 * This is Layer 1 of the 2-layer config resolution. Project-level
 * settings (Layer 2) are deep-merged on top of these defaults.
 *
 * Four built-in workflows cover the common issue types:
 *   feature: research → scope → plan → build (linear chain)
 *   bug:     reproduce → fix → verify
 *   chore:   do (single step)
 *   spike:   research → recommend
 */

import type { TwistedConfig } from '../types/config.js';

export const DEFAULT_CONFIG: TwistedConfig = {
  version: '4.0',

  workflows: [
    {
      id: 'feature',
      title: 'Feature',
      default_for: ['feature'],
      steps: [
        { id: 'research', title: 'Research', needs: [] },
        { id: 'scope', title: 'Scope', needs: ['research'] },
        { id: 'plan', title: 'Plan', needs: ['scope'] },
        { id: 'build', title: 'Build', needs: ['plan'] },
      ],
    },
    {
      id: 'bug',
      title: 'Bug',
      default_for: ['bug'],
      steps: [
        { id: 'reproduce', title: 'Reproduce', needs: [] },
        { id: 'fix', title: 'Fix', needs: ['reproduce'] },
        { id: 'verify', title: 'Verify', needs: ['fix'] },
      ],
    },
    {
      id: 'chore',
      title: 'Chore',
      default_for: ['chore'],
      steps: [
        { id: 'do', title: 'Do', needs: [] },
      ],
    },
    {
      id: 'spike',
      title: 'Spike',
      default_for: ['spike'],
      steps: [
        { id: 'research', title: 'Research', needs: [] },
        { id: 'recommend', title: 'Recommend', needs: ['research'] },
      ],
    },
  ],

  context_skills: [],
  step_skills: {},
  step_review_skills: {},
};
