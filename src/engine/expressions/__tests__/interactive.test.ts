import { describe, it, expect } from 'vitest';
import {
  createInteractiveFunctions,
  createInteractiveEvaluator,
} from '../interactive.js';
import { ExpressionEvaluator } from '../evaluator.js';
import { buildTaskContext, buildArtifactContext } from '../context.js';
import type { ExpressionContext } from '../../../types/expressions.js';
import type { IssueState } from '../../../types/protocol.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides: Partial<IssueState> = {}): IssueState {
  return {
    issue: 'test-issue',
    type: 'feature',
    workflow_id: 'default',
    step: 'build',
    status: 'open',
    tasks_done: 0,
    tasks_total: null,
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ExpressionContext> = {}): ExpressionContext {
  return {
    vars: {},
    issue: makeIssue(),
    artifacts: buildArtifactContext([], []),
    tasks: buildTaskContext([]),
    cycle: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// confirm()
// ---------------------------------------------------------------------------

describe('confirm()', () => {
  it('returns paused result with confirm action', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("confirm('Are you sure?')", makeContext());
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'confirm',
        message: 'Are you sure?',
        next_command: 'resume',
      },
    });
  });

  it('returns error for wrong argument count', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate('confirm()', makeContext());
    expect(result).toEqual({
      ok: false,
      error: 'confirm() expects 1 argument, got 0',
    });
  });

  it('returns error for non-string argument', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate('confirm(42)', makeContext());
    expect(result).toEqual({
      ok: false,
      error: 'confirm() argument must be a string',
    });
  });
});

// ---------------------------------------------------------------------------
// prompt()
// ---------------------------------------------------------------------------

describe('prompt()', () => {
  it('returns paused result with prompt_user action', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("prompt('What is the PR URL?')", makeContext());
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'prompt_user',
        prompt: 'What is the PR URL?',
      },
    });
  });

  it('returns error for wrong argument count', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("prompt('a', 'b')", makeContext());
    expect(result).toEqual({
      ok: false,
      error: 'prompt() expects 1 argument, got 2',
    });
  });
});

// ---------------------------------------------------------------------------
// choose()
// ---------------------------------------------------------------------------

describe('choose()', () => {
  it('returns paused result with categories', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate(
      "choose('Which environment?', 'staging', 'prod')",
      makeContext(),
    );
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'prompt_user',
        prompt: 'Which environment?',
        categories: ['staging', 'prod'],
      },
    });
  });

  it('returns error when fewer than 2 arguments', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("choose('Pick one')", makeContext());
    expect(result).toEqual({
      ok: false,
      error: 'choose() expects at least 2 arguments (message + choices), got 1',
    });
  });
});

// ---------------------------------------------------------------------------
// Short-circuit propagation with interactive functions
// ---------------------------------------------------------------------------

describe('paused result propagation in binary expressions', () => {
  it('"confirm(\'deploy?\') and true" returns paused (confirm evaluated first)', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("confirm('deploy?') and true", makeContext());
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'confirm',
        message: 'deploy?',
        next_command: 'resume',
      },
    });
  });

  it('"true and confirm(\'deploy?\')" returns paused (confirm is reached)', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("true and confirm('deploy?')", makeContext());
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'confirm',
        message: 'deploy?',
        next_command: 'resume',
      },
    });
  });

  it('"false and confirm(\'deploy?\')" short-circuits — confirm never called', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("false and confirm('deploy?')", makeContext());
    // Short-circuit: false and X → false, without evaluating X
    expect(result).toEqual({ ok: true, value: false });
  });

  it('"true or confirm(\'deploy?\')" short-circuits — confirm never called', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("true or confirm('deploy?')", makeContext());
    // Short-circuit: true or X → true, without evaluating X
    expect(result).toEqual({ ok: true, value: true });
  });

  it('"false or confirm(\'deploy?\')" returns paused (confirm is reached)', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate("false or confirm('deploy?')", makeContext());
    expect(result).toEqual({
      ok: 'paused',
      action: {
        type: 'confirm',
        message: 'deploy?',
        next_command: 'resume',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// createInteractiveEvaluator factory
// ---------------------------------------------------------------------------

describe('createInteractiveEvaluator()', () => {
  it('creates evaluator with all three interactive functions registered', () => {
    const evaluator = createInteractiveEvaluator();

    // Each function is callable without "Unknown function" errors
    const confirmResult = evaluator.evaluate("confirm('test')", makeContext());
    expect(confirmResult.ok).toBe('paused');

    const promptResult = evaluator.evaluate("prompt('test')", makeContext());
    expect(promptResult.ok).toBe('paused');

    const chooseResult = evaluator.evaluate("choose('test', 'a', 'b')", makeContext());
    expect(chooseResult.ok).toBe('paused');
  });

  it('also has built-in functions available', () => {
    const evaluator = createInteractiveEvaluator();
    const result = evaluator.evaluate('defined(null)', makeContext());
    expect(result).toEqual({ ok: true, value: false });
  });
});

// ---------------------------------------------------------------------------
// createInteractiveFunctions factory
// ---------------------------------------------------------------------------

describe('createInteractiveFunctions()', () => {
  it('returns a Map with confirm, prompt, and choose', () => {
    const fns = createInteractiveFunctions();
    expect(fns.has('confirm')).toBe(true);
    expect(fns.has('prompt')).toBe(true);
    expect(fns.has('choose')).toBe(true);
    expect(fns.size).toBe(3);
  });

  it('can be passed to ExpressionEvaluator as extraFunctions', () => {
    const evaluator = new ExpressionEvaluator(createInteractiveFunctions());
    const result = evaluator.evaluate("confirm('works')", makeContext());
    expect(result.ok).toBe('paused');
  });
});

// ---------------------------------------------------------------------------
// Vars-based resume: no pause when var already present
// ---------------------------------------------------------------------------

describe('vars-based resume (no pause when var is present)', () => {
  it('"vars.confirmed == true" evaluates normally when var exists', () => {
    const evaluator = createInteractiveEvaluator();
    const ctx = makeContext({ vars: { confirmed: true } });
    const result = evaluator.evaluate('vars.confirmed == true', ctx);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('"vars.confirmed == true" returns false when var is false', () => {
    const evaluator = createInteractiveEvaluator();
    const ctx = makeContext({ vars: { confirmed: false } });
    const result = evaluator.evaluate('vars.confirmed == true', ctx);
    expect(result).toEqual({ ok: true, value: false });
  });

  it('"vars.confirmed == true" returns false when var is missing (null)', () => {
    const evaluator = createInteractiveEvaluator();
    const ctx = makeContext({ vars: {} });
    const result = evaluator.evaluate('vars.confirmed == true', ctx);
    expect(result).toEqual({ ok: true, value: false });
  });
});
