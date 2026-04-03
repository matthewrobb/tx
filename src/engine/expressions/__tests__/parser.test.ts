import { describe, it, expect } from 'vitest';
import { parse, tokenize } from '../parser.js';
import type { ExpressionNode } from '../../../types/expressions.js';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('tokenizes identifiers and keywords', () => {
    const result = tokenize('not tasks and issue or true');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.tokens.map((t) => t.kind);
    expect(kinds).toEqual(['not', 'ident', 'and', 'ident', 'or', 'true', 'eof']);
  });

  it('tokenizes string literals (single and double quoted)', () => {
    const result = tokenize("'hello' \"world\"");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens[0]).toMatchObject({ kind: 'string', value: 'hello' });
    expect(result.tokens[1]).toMatchObject({ kind: 'string', value: 'world' });
  });

  it('tokenizes numbers (integer and float)', () => {
    const result = tokenize('42 3.14');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens[0]).toMatchObject({ kind: 'number', value: '42' });
    expect(result.tokens[1]).toMatchObject({ kind: 'number', value: '3.14' });
  });

  it('tokenizes comparison operators', () => {
    const result = tokenize('== != < <= > >=');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.tokens.map((t) => t.kind);
    expect(kinds).toEqual(['==', '!=', '<', '<=', '>', '>=', 'eof']);
  });

  it('returns error for unterminated string', () => {
    const result = tokenize("'hello");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unterminated string');
  });

  it('returns error for unexpected character', () => {
    const result = tokenize('a @ b');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('@');
  });
});

// ---------------------------------------------------------------------------
// Parser — Literals
// ---------------------------------------------------------------------------

describe('parse literals', () => {
  it('parses string literals', () => {
    const result = parse("'hello'");
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: 'hello' } });
  });

  it('parses double-quoted strings', () => {
    const result = parse('"world"');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: 'world' } });
  });

  it('parses integer numbers', () => {
    const result = parse('42');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: 42 } });
  });

  it('parses float numbers', () => {
    const result = parse('3.14');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: 3.14 } });
  });

  it('parses true', () => {
    const result = parse('true');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: true } });
  });

  it('parses false', () => {
    const result = parse('false');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: false } });
  });

  it('parses null', () => {
    const result = parse('null');
    expect(result).toEqual({ ok: true, node: { kind: 'literal', value: null } });
  });
});

// ---------------------------------------------------------------------------
// Parser — Identifiers
// ---------------------------------------------------------------------------

describe('parse identifiers', () => {
  it('parses a simple identifier', () => {
    const result = parse('issue');
    expect(result).toEqual({ ok: true, node: { kind: 'identifier', name: 'issue' } });
  });

  it('parses underscore-prefixed identifier', () => {
    const result = parse('_private');
    expect(result).toEqual({ ok: true, node: { kind: 'identifier', name: '_private' } });
  });
});

// ---------------------------------------------------------------------------
// Parser — Member access
// ---------------------------------------------------------------------------

describe('parse member access', () => {
  it('parses single member access', () => {
    const result = parse('issue.type');
    expect(result).toEqual({
      ok: true,
      node: {
        kind: 'member',
        object: { kind: 'identifier', name: 'issue' },
        property: 'type',
      },
    });
  });

  it('parses chained member access (left-associative)', () => {
    const result = parse('a.b.c');
    expect(result).toEqual({
      ok: true,
      node: {
        kind: 'member',
        object: {
          kind: 'member',
          object: { kind: 'identifier', name: 'a' },
          property: 'b',
        },
        property: 'c',
      },
    });
  });

  it('parses artifacts.all_present', () => {
    const result = parse('artifacts.all_present');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'member',
      object: { kind: 'identifier', name: 'artifacts' },
      property: 'all_present',
    });
  });
});

// ---------------------------------------------------------------------------
// Parser — Comparisons
// ---------------------------------------------------------------------------

describe('parse comparisons', () => {
  it('parses equality', () => {
    const result = parse("issue.type == 'bug'");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const node = result.node;
    expect(node.kind).toBe('binary');
    if (node.kind !== 'binary') return;
    expect(node.op).toBe('eq');
    expect(node.left).toMatchObject({ kind: 'member', property: 'type' });
    expect(node.right).toMatchObject({ kind: 'literal', value: 'bug' });
  });

  it('parses inequality', () => {
    const result = parse('a != b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({ kind: 'binary', op: 'neq' });
  });

  it('parses less-than and related operators', () => {
    for (const [op, expected] of [
      ['<', 'lt'],
      ['<=', 'lte'],
      ['>', 'gt'],
      ['>=', 'gte'],
    ] as const) {
      const result = parse(`a ${op} b`);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.node).toMatchObject({ kind: 'binary', op: expected });
    }
  });
});

// ---------------------------------------------------------------------------
// Parser — Boolean operators
// ---------------------------------------------------------------------------

describe('parse boolean operators', () => {
  it('parses not', () => {
    const result = parse('not tasks.all_done');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'unary',
      op: 'not',
      operand: {
        kind: 'member',
        object: { kind: 'identifier', name: 'tasks' },
        property: 'all_done',
      },
    });
  });

  it('parses and', () => {
    const result = parse('a and b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'and',
      left: { kind: 'identifier', name: 'a' },
      right: { kind: 'identifier', name: 'b' },
    });
  });

  it('parses or', () => {
    const result = parse('a or b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'or',
      left: { kind: 'identifier', name: 'a' },
      right: { kind: 'identifier', name: 'b' },
    });
  });

  it('and binds tighter than or', () => {
    // "a or b and c" should parse as "a or (b and c)"
    const result = parse('a or b and c');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'or',
      left: { kind: 'identifier', name: 'a' },
      right: {
        kind: 'binary',
        op: 'and',
        left: { kind: 'identifier', name: 'b' },
        right: { kind: 'identifier', name: 'c' },
      },
    });
  });

  it('not binds tighter than and', () => {
    // "not a and b" should parse as "(not a) and b"
    const result = parse('not a and b');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'and',
      left: { kind: 'unary', op: 'not', operand: { kind: 'identifier', name: 'a' } },
      right: { kind: 'identifier', name: 'b' },
    });
  });
});

// ---------------------------------------------------------------------------
// Parser — Grouped/nested expressions
// ---------------------------------------------------------------------------

describe('parse nested expressions', () => {
  it('parses parenthesized expression', () => {
    const result = parse('(a and b)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'and',
    });
  });

  it('parses not (a and b) or c', () => {
    const result = parse('not (a and b) or c');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should be: or(not(and(a, b)), c)
    expect(result.node).toMatchObject({
      kind: 'binary',
      op: 'or',
      left: {
        kind: 'unary',
        op: 'not',
        operand: {
          kind: 'binary',
          op: 'and',
          left: { kind: 'identifier', name: 'a' },
          right: { kind: 'identifier', name: 'b' },
        },
      },
      right: { kind: 'identifier', name: 'c' },
    });
  });
});

// ---------------------------------------------------------------------------
// Parser — Function calls
// ---------------------------------------------------------------------------

describe('parse function calls', () => {
  it('parses zero-arg call', () => {
    const result = parse('do_thing()');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'call',
      callee: { kind: 'identifier', name: 'do_thing' },
      args: [],
    });
  });

  it('parses single-arg call', () => {
    const result = parse('defined(issue.body)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'call',
      callee: { kind: 'identifier', name: 'defined' },
      args: [
        {
          kind: 'member',
          object: { kind: 'identifier', name: 'issue' },
          property: 'body',
        },
      ],
    });
  });

  it('parses multi-arg call', () => {
    const result = parse("includes(tags, 'urgent')");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.node).toMatchObject({
      kind: 'call',
      callee: { kind: 'identifier', name: 'includes' },
      args: [
        { kind: 'identifier', name: 'tags' },
        { kind: 'literal', value: 'urgent' },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Parser — Error cases
// ---------------------------------------------------------------------------

describe('parse errors', () => {
  it('returns error for empty input', () => {
    const result = parse('');
    expect(result.ok).toBe(false);
  });

  it('returns error for trailing tokens', () => {
    const result = parse('a b');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unexpected');
  });

  it('returns error for missing closing paren', () => {
    const result = parse('(a and b');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(')');
  });

  it('returns error for missing property after dot', () => {
    const result = parse('a.');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('identifier');
  });

  it('returns error for operator without right operand', () => {
    const result = parse('a ==');
    expect(result.ok).toBe(false);
  });
});
