import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../evaluator.js';
import { buildTaskContext, buildArtifactContext } from '../context.js';
import type { ExpressionContext } from '../../../types/expressions.js';
import type { IssueState } from '../../../types/protocol.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal IssueState fixture — only the fields expressions typically access. */
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
// Literal evaluation
// ---------------------------------------------------------------------------

describe('evaluate literals', () => {
  const evaluator = new ExpressionEvaluator();

  it('evaluates string literal', () => {
    const result = evaluator.evaluate("'hello'", makeContext());
    expect(result).toEqual({ ok: true, value: 'hello' });
  });

  it('evaluates number literal', () => {
    const result = evaluator.evaluate('42', makeContext());
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('evaluates boolean literals', () => {
    expect(evaluator.evaluate('true', makeContext())).toEqual({ ok: true, value: true });
    expect(evaluator.evaluate('false', makeContext())).toEqual({ ok: true, value: false });
  });

  it('evaluates null literal', () => {
    expect(evaluator.evaluate('null', makeContext())).toEqual({ ok: true, value: null });
  });
});

// ---------------------------------------------------------------------------
// Namespace member access
// ---------------------------------------------------------------------------

describe('evaluate member access', () => {
  const evaluator = new ExpressionEvaluator();

  it('resolves issue.type from context', () => {
    const ctx = makeContext({ issue: makeIssue({ type: 'bug' }) });
    const result = evaluator.evaluate('issue.type', ctx);
    expect(result).toEqual({ ok: true, value: 'bug' });
  });

  it('resolves issue.status', () => {
    const ctx = makeContext({ issue: makeIssue({ status: 'blocked' }) });
    expect(evaluator.evaluate('issue.status', ctx)).toEqual({ ok: true, value: 'blocked' });
  });

  it('resolves tasks.all_done', () => {
    const ctx = makeContext({
      tasks: buildTaskContext([{ done: true }, { done: true }]),
    });
    expect(evaluator.evaluate('tasks.all_done', ctx)).toEqual({ ok: true, value: true });
  });

  it('resolves tasks.done_count', () => {
    const ctx = makeContext({
      tasks: buildTaskContext([{ done: true }, { done: false }]),
    });
    expect(evaluator.evaluate('tasks.done_count', ctx)).toEqual({ ok: true, value: 1 });
  });

  it('resolves artifacts.all_present when all present', () => {
    const ctx = makeContext({
      artifacts: buildArtifactContext(['a.md', 'b.md'], ['a.md', 'b.md']),
    });
    expect(evaluator.evaluate('artifacts.all_present', ctx)).toEqual({ ok: true, value: true });
  });

  it('resolves artifacts.all_present when some missing', () => {
    const ctx = makeContext({
      artifacts: buildArtifactContext(['a.md', 'b.md'], ['a.md']),
    });
    expect(evaluator.evaluate('artifacts.all_present', ctx)).toEqual({ ok: true, value: false });
  });

  it('resolves vars from context', () => {
    const ctx = makeContext({ vars: { my_flag: true } });
    expect(evaluator.evaluate('vars.my_flag', ctx)).toEqual({ ok: true, value: true });
  });
});

// ---------------------------------------------------------------------------
// Null propagation
// ---------------------------------------------------------------------------

describe('null propagation', () => {
  const evaluator = new ExpressionEvaluator();

  it('returns null for unknown top-level identifier', () => {
    const result = evaluator.evaluate('unknown_name', makeContext());
    expect(result).toEqual({ ok: true, value: null });
  });

  it('returns null for member access on null (cycle is null)', () => {
    const ctx = makeContext({ cycle: null });
    expect(evaluator.evaluate('cycle.slug', ctx)).toEqual({ ok: true, value: null });
  });

  it('returns null for deep member access on null', () => {
    const ctx = makeContext({ cycle: null });
    expect(evaluator.evaluate('cycle.some.deep.path', ctx)).toEqual({ ok: true, value: null });
  });

  it('returns null for missing vars key', () => {
    const ctx = makeContext({ vars: {} });
    expect(evaluator.evaluate('vars.nonexistent', ctx)).toEqual({ ok: true, value: null });
  });
});

// ---------------------------------------------------------------------------
// Comparison operators
// ---------------------------------------------------------------------------

describe('evaluate comparisons', () => {
  const evaluator = new ExpressionEvaluator();

  it('eq: equal strings', () => {
    const ctx = makeContext({ issue: makeIssue({ type: 'bug' }) });
    expect(evaluator.evaluate("issue.type == 'bug'", ctx)).toEqual({ ok: true, value: true });
  });

  it('eq: unequal strings', () => {
    const ctx = makeContext({ issue: makeIssue({ type: 'feature' }) });
    expect(evaluator.evaluate("issue.type == 'bug'", ctx)).toEqual({ ok: true, value: false });
  });

  it('neq: unequal values', () => {
    expect(evaluator.evaluate("'a' != 'b'", makeContext())).toEqual({ ok: true, value: true });
  });

  it('neq: equal values', () => {
    expect(evaluator.evaluate("'a' != 'a'", makeContext())).toEqual({ ok: true, value: false });
  });

  it('lt: numeric less-than', () => {
    expect(evaluator.evaluate('1 < 2', makeContext())).toEqual({ ok: true, value: true });
    expect(evaluator.evaluate('2 < 1', makeContext())).toEqual({ ok: true, value: false });
  });

  it('lte: numeric less-or-equal', () => {
    expect(evaluator.evaluate('1 <= 1', makeContext())).toEqual({ ok: true, value: true });
    expect(evaluator.evaluate('2 <= 1', makeContext())).toEqual({ ok: true, value: false });
  });

  it('gt and gte', () => {
    expect(evaluator.evaluate('3 > 2', makeContext())).toEqual({ ok: true, value: true });
    expect(evaluator.evaluate('2 >= 2', makeContext())).toEqual({ ok: true, value: true });
  });

  it('numeric comparison with non-numbers returns false', () => {
    expect(evaluator.evaluate("'a' < 'b'", makeContext())).toEqual({ ok: true, value: false });
    expect(evaluator.evaluate("null < 1", makeContext())).toEqual({ ok: true, value: false });
  });

  it('eq: null == null', () => {
    // Both sides resolve to null (unknown ident), so they should be equal
    expect(evaluator.evaluate('nothing == null', makeContext())).toEqual({ ok: true, value: true });
  });
});

// ---------------------------------------------------------------------------
// Boolean operators — and/or/not
// ---------------------------------------------------------------------------

describe('evaluate boolean operators', () => {
  const evaluator = new ExpressionEvaluator();

  it('and: both truthy', () => {
    expect(evaluator.evaluate('true and true', makeContext())).toEqual({ ok: true, value: true });
  });

  it('and: left falsy short-circuits', () => {
    // false and (anything) should return false without evaluating right
    expect(evaluator.evaluate('false and true', makeContext())).toEqual({ ok: true, value: false });
  });

  it('and: right falsy', () => {
    expect(evaluator.evaluate('true and false', makeContext())).toEqual({ ok: true, value: false });
  });

  it('or: left truthy short-circuits', () => {
    expect(evaluator.evaluate('true or false', makeContext())).toEqual({ ok: true, value: true });
  });

  it('or: left falsy, right truthy', () => {
    expect(evaluator.evaluate('false or true', makeContext())).toEqual({ ok: true, value: true });
  });

  it('or: both falsy', () => {
    expect(evaluator.evaluate('false or false', makeContext())).toEqual({ ok: true, value: false });
  });

  it('not: negates truthy', () => {
    expect(evaluator.evaluate('not true', makeContext())).toEqual({ ok: true, value: false });
  });

  it('not: negates falsy', () => {
    expect(evaluator.evaluate('not false', makeContext())).toEqual({ ok: true, value: true });
  });

  it('not null is truthy', () => {
    expect(evaluator.evaluate('not null', makeContext())).toEqual({ ok: true, value: true });
  });

  it('and/or short-circuit prevents evaluation errors', () => {
    // "false and unknown_fn()" — should short-circuit and not call the function
    const result = evaluator.evaluate('false and unknown_fn()', makeContext());
    // This evaluates to false without trying to call unknown_fn
    expect(result).toEqual({ ok: true, value: false });
  });

  it('or short-circuit prevents evaluation errors', () => {
    // "true or unknown_fn()" — should short-circuit
    const result = evaluator.evaluate('true or unknown_fn()', makeContext());
    expect(result).toEqual({ ok: true, value: true });
  });
});

// ---------------------------------------------------------------------------
// Built-in function calls
// ---------------------------------------------------------------------------

describe('evaluate built-in functions', () => {
  const evaluator = new ExpressionEvaluator();

  it('defined() returns true for non-null', () => {
    const ctx = makeContext({ vars: { x: 'hello' } });
    expect(evaluator.evaluate('defined(vars.x)', ctx)).toEqual({ ok: true, value: true });
  });

  it('defined() returns false for null', () => {
    expect(evaluator.evaluate('defined(vars.missing)', makeContext())).toEqual({
      ok: true,
      value: false,
    });
  });

  it('not_empty() returns true for non-empty string', () => {
    const ctx = makeContext({ vars: { s: 'hi' } });
    expect(evaluator.evaluate("not_empty(vars.s)", ctx)).toEqual({ ok: true, value: true });
  });

  it('not_empty() returns false for empty string', () => {
    const ctx = makeContext({ vars: { s: '' } });
    expect(evaluator.evaluate("not_empty(vars.s)", ctx)).toEqual({ ok: true, value: false });
  });

  it('not_empty() returns false for null', () => {
    expect(evaluator.evaluate('not_empty(null)', makeContext())).toEqual({
      ok: true,
      value: false,
    });
  });

  it('count() returns array length', () => {
    const ctx = makeContext({ vars: { items: [1, 2, 3] } });
    expect(evaluator.evaluate('count(vars.items)', ctx)).toEqual({ ok: true, value: 3 });
  });

  it('count() returns null for non-array', () => {
    const ctx = makeContext({ vars: { x: 'not an array' } });
    expect(evaluator.evaluate('count(vars.x)', ctx)).toEqual({ ok: true, value: null });
  });

  it('includes() finds item in array', () => {
    const ctx = makeContext({ vars: { tags: ['a', 'b', 'c'] } });
    expect(evaluator.evaluate("includes(vars.tags, 'b')", ctx)).toEqual({ ok: true, value: true });
  });

  it('includes() returns false when item not found', () => {
    const ctx = makeContext({ vars: { tags: ['a', 'b'] } });
    expect(evaluator.evaluate("includes(vars.tags, 'z')", ctx)).toEqual({
      ok: true,
      value: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown function → error
// ---------------------------------------------------------------------------

describe('evaluate unknown function', () => {
  const evaluator = new ExpressionEvaluator();

  it('returns error for unknown function', () => {
    const result = evaluator.evaluate('no_such_fn(1)', makeContext());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unknown function');
    expect(result.error).toContain('no_such_fn');
  });
});

// ---------------------------------------------------------------------------
// Full integration expression
// ---------------------------------------------------------------------------

describe('evaluate full expressions', () => {
  const evaluator = new ExpressionEvaluator();

  it('"not tasks.all_done and issue.status == \'open\'" evaluates correctly', () => {
    const ctx = makeContext({
      tasks: buildTaskContext([{ done: false }, { done: true }]),
      issue: makeIssue({ status: 'open' }),
    });
    const result = evaluator.evaluate("not tasks.all_done and issue.status == 'open'", ctx);
    // tasks.all_done = false, so not tasks.all_done = true
    // issue.status == 'open' = true
    // true and true = true
    expect(result).toEqual({ ok: true, value: true });
  });

  it('"artifacts.all_present" in a done_when condition', () => {
    const ctx = makeContext({
      artifacts: buildArtifactContext(['scope.md', 'plan.md'], ['scope.md', 'plan.md']),
    });
    expect(evaluator.evaluate('artifacts.all_present', ctx)).toEqual({ ok: true, value: true });
  });

  it('"issue.type == \'chore\'" for skip_when', () => {
    const ctx = makeContext({ issue: makeIssue({ type: 'chore' }) });
    expect(evaluator.evaluate("issue.type == 'chore'", ctx)).toEqual({ ok: true, value: true });
  });

  it('complex expression with multiple operators', () => {
    const ctx = makeContext({
      tasks: buildTaskContext([{ done: true }, { done: true }]),
      issue: makeIssue({ status: 'open' }),
      vars: { priority: 'high' },
    });
    // tasks.all_done = true, so not tasks.all_done = false
    // false or (vars.priority == 'high') = true
    const result = evaluator.evaluate("not tasks.all_done or vars.priority == 'high'", ctx);
    expect(result).toEqual({ ok: true, value: true });
  });
});

// ---------------------------------------------------------------------------
// Validate method
// ---------------------------------------------------------------------------

describe('validate', () => {
  const evaluator = new ExpressionEvaluator();

  it('returns valid for correct expression', () => {
    expect(evaluator.validate("issue.type == 'bug'")).toEqual({ valid: true });
  });

  it('returns error for malformed expression', () => {
    const result = evaluator.validate('issue.');
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

describe('buildTaskContext', () => {
  it('empty tasks: all_done = false', () => {
    const ctx = buildTaskContext([]);
    expect(ctx.all_done).toBe(false);
    expect(ctx.done_count).toBe(0);
    expect(ctx.total_count).toBe(0);
  });

  it('all done: all_done = true', () => {
    const ctx = buildTaskContext([{ done: true }, { done: true }]);
    expect(ctx.all_done).toBe(true);
    expect(ctx.done_count).toBe(2);
    expect(ctx.total_count).toBe(2);
  });

  it('some done: all_done = false', () => {
    const ctx = buildTaskContext([{ done: true }, { done: false }]);
    expect(ctx.all_done).toBe(false);
    expect(ctx.done_count).toBe(1);
  });
});

describe('buildArtifactContext', () => {
  it('all present: all_present = true', () => {
    const ctx = buildArtifactContext(['a', 'b'], ['a', 'b']);
    expect(ctx.all_present).toBe(true);
    expect(ctx.exists('a')).toBe(true);
    expect(ctx.exists('c')).toBe(false);
  });

  it('some missing: all_present = false', () => {
    const ctx = buildArtifactContext(['a', 'b'], ['a']);
    expect(ctx.all_present).toBe(false);
  });

  it('no required: all_present = false', () => {
    // Edge case: if no artifacts are required, all_present is false
    // (there's nothing to check — vacuous truth would be confusing here)
    const ctx = buildArtifactContext([], []);
    expect(ctx.all_present).toBe(false);
  });
});
