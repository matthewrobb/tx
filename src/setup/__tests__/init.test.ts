// src/setup/__tests__/init.test.ts — tests for the guided tx init flow.
//
// Tests use a real temp directory via Node's os.tmpdir() + a unique suffix.
// This exercises the actual mkdir/writeFile path without mocking fs, which
// matches the codebase pattern of testing real behavior over mocked seams.
// Each test gets its own isolated directory; cleanup happens in afterEach.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, readFile, mkdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runInit } from '../init.js';
import type { SetupState } from '../questions.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  // Each test gets a fresh isolated temp directory.
  tmpDir = path.join(os.tmpdir(), `twisted-setup-test-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. No state → returns welcome prompt
// ---------------------------------------------------------------------------

describe('first call — no state', () => {
  it('returns status prompting with a prompt_user action', async () => {
    const result = await runInit({ cwd: tmpDir });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;

    expect(result.action.type).toBe('prompt_user');
    // State is initialised at 'welcome'
    expect(result.state.step).toBe('welcome');
  });

  it('welcome prompt mentions simple, standard, and custom', async () => {
    const result = await runInit({ cwd: tmpDir });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;
    if (result.action.type !== 'prompt_user') return;

    expect(result.action.prompt).toContain('simple');
    expect(result.action.prompt).toContain('standard');
    expect(result.action.prompt).toContain('custom');
  });
});

// ---------------------------------------------------------------------------
// 2. After welcome response → advances to skill_packages
// ---------------------------------------------------------------------------

describe('after welcome response', () => {
  it('advances to skill_packages after workflow_style = simple', async () => {
    // First call — get initial state
    const first = await runInit({ cwd: tmpDir });
    expect(first.status).toBe('prompting');
    if (first.status !== 'prompting') return;

    // Second call — respond with 'simple'
    const second = await runInit({
      cwd: tmpDir,
      state: first.state,
      response: 'simple',
    });

    expect(second.status).toBe('prompting');
    if (second.status !== 'prompting') return;

    expect(second.state.step).toBe('skill_packages');
    expect(second.state.answers.workflow_style).toBe('simple');
  });

  it('records workflow_style in state.answers', async () => {
    const first = await runInit({ cwd: tmpDir });
    if (first.status !== 'prompting') return;

    const second = await runInit({
      cwd: tmpDir,
      state: first.state,
      response: 'standard',
    });

    if (second.status !== 'prompting') return;
    expect(second.state.answers.workflow_style).toBe('standard');
  });
});

// ---------------------------------------------------------------------------
// 3. workflow_style = 'simple' → advances to skill_packages
// ---------------------------------------------------------------------------

describe('workflow_style advances to skill_packages', () => {
  it('skill_packages prompt asks for comma-separated npm names', async () => {
    const state: SetupState = {
      step: 'workflow_style',
      answers: {},
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'simple' });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;

    expect(result.state.step).toBe('skill_packages');
    expect(result.action.type).toBe('prompt_user');
    if (result.action.type !== 'prompt_user') return;
    expect(result.action.prompt.toLowerCase()).toContain('package');
  });
});

// ---------------------------------------------------------------------------
// 4. Full flow through to confirm → returns complete with generated config
// ---------------------------------------------------------------------------

describe('full setup flow — simple + no packages + deferral enabled', () => {
  it('returns complete after confirm with the resolved config', async () => {
    // Turn 1: no state → welcome
    const t1 = await runInit({ cwd: tmpDir });
    expect(t1.status).toBe('prompting');
    if (t1.status !== 'prompting') return;

    // Turn 2: respond 'simple'
    const t2 = await runInit({ cwd: tmpDir, state: t1.state, response: 'simple' });
    expect(t2.status).toBe('prompting');
    if (t2.status !== 'prompting') return;
    expect(t2.state.step).toBe('skill_packages');

    // Turn 3: no packages
    const t3 = await runInit({ cwd: tmpDir, state: t2.state, response: '' });
    expect(t3.status).toBe('prompting');
    if (t3.status !== 'prompting') return;
    expect(t3.state.step).toBe('policies');

    // Turn 4: enable deferral policy
    const t4 = await runInit({ cwd: tmpDir, state: t3.state, response: 'yes' });
    expect(t4.status).toBe('prompting');
    if (t4.status !== 'prompting') return;
    expect(t4.state.step).toBe('confirm');

    // Turn 5: confirm
    const t5 = await runInit({ cwd: tmpDir, state: t4.state, response: 'yes' });
    expect(t5.status).toBe('complete');
    if (t5.status !== 'complete') return;

    // Config should be fully resolved (has version, workflows, etc.)
    expect(t5.config.version).toBe('4.0');
    expect(t5.config.workflows).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5. 'standard' style → TwistedSettings has version only (no workflow override)
// ---------------------------------------------------------------------------

describe("'standard' style settings generation", () => {
  it('settings.json contains only version field (no workflows key)', async () => {
    // Drive to confirm with standard style
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'yes' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    const raw = await readFile(result.settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Standard style → no workflow override in settings
    expect(parsed['workflows']).toBeUndefined();
    expect(parsed['version']).toBe('4.0');
  });

  it('resolved config includes all four built-in workflows for standard style', async () => {
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'yes' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    const ids = result.config.workflows.map((w) => w.id);
    expect(ids).toContain('feature');
    expect(ids).toContain('bug');
    expect(ids).toContain('chore');
    expect(ids).toContain('spike');
  });
});

// ---------------------------------------------------------------------------
// 6. Deferral policy enabled → settings includes policies.deferral
// ---------------------------------------------------------------------------

describe('deferral policy enabled', () => {
  it('settings.json includes policies.deferral expression', async () => {
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: true,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'yes' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    const raw = await readFile(result.settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const policies = parsed['policies'] as Record<string, unknown> | undefined;

    expect(policies).toBeDefined();
    expect(typeof policies?.['deferral']).toBe('string');
    expect(String(policies?.['deferral'])).toContain('confirm');
  });

  it('settings.json has no policies key when deferral is disabled', async () => {
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'yes' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    const raw = await readFile(result.settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed['policies']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 7. On complete → writes .twisted/settings.json to disk
// ---------------------------------------------------------------------------

describe('file system writes', () => {
  it('writes .twisted/settings.json when setup completes', async () => {
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'confirm' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    // settingsPath is absolute and points into the tmp dir
    expect(result.settingsPath).toContain('.twisted');
    expect(result.settingsPath).toContain('settings.json');

    // File actually exists and is valid JSON
    const raw = await readFile(result.settingsPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('creates .twisted/ directory if it does not exist', async () => {
    // tmpDir is fresh — no .twisted/ inside it yet
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'simple',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'y' });
    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    // Settings file is readable
    const raw = await readFile(result.settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed['version']).toBe('4.0');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns error for invalid workflow_style response', async () => {
    const state: SetupState = { step: 'workflow_style', answers: {} };
    const result = await runInit({ cwd: tmpDir, state, response: 'invalid-style' });

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.message).toContain('Invalid workflow style');
  });

  it('parses comma-separated package names correctly', async () => {
    const state: SetupState = {
      step: 'skill_packages',
      answers: { workflow_style: 'standard' },
    };

    const result = await runInit({
      cwd: tmpDir,
      state,
      response: '@twisted/skills-ts, twisted-react, twisted-testing',
    });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;
    expect(result.state.answers.install_packages).toEqual([
      '@twisted/skills-ts',
      'twisted-react',
      'twisted-testing',
    ]);
  });

  it('treats empty response to skill_packages as no packages', async () => {
    const state: SetupState = {
      step: 'skill_packages',
      answers: { workflow_style: 'standard' },
    };

    const result = await runInit({ cwd: tmpDir, state, response: '   ' });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;
    expect(result.state.answers.install_packages).toEqual([]);
  });

  it('declining confirm restarts the flow from welcome', async () => {
    const state: SetupState = {
      step: 'confirm',
      answers: {
        workflow_style: 'standard',
        install_packages: [],
        enable_deferral_policy: false,
      },
    };

    const result = await runInit({ cwd: tmpDir, state, response: 'no' });

    expect(result.status).toBe('prompting');
    if (result.status !== 'prompting') return;
    // Restarted — back to welcome step, cleared answers
    expect(result.state.step).toBe('welcome');
    expect(result.state.answers).toEqual({});
  });
});
