// src/engine/expressions/parser.ts — Tokenizer + recursive descent parser
//
// Parses expression strings like "not tasks.all_done and issue.type == 'bug'"
// into an ExpressionNode AST defined in src/types/expressions.ts.
//
// Grammar (precedence low→high):
//   expr         = or_expr
//   or_expr      = and_expr ('or' and_expr)*
//   and_expr     = not_expr ('and' not_expr)*
//   not_expr     = 'not' not_expr | compare_expr
//   compare_expr = member_expr (('==' | '!=' | '<' | '<=' | '>' | '>=') member_expr)?
//   member_expr  = call_expr ('.' IDENT)*
//   call_expr    = primary | IDENT '(' args ')'
//   primary      = LITERAL | IDENT | '(' expr ')'
//   args         = (expr (',' expr)*)?
//
// Design decisions:
// - Word-form 'and'/'or'/'not' rather than &&/||/! because these appear in
//   YAML/JSON config where symbolic operators require escaping.
// - No arithmetic — expressions are conditions, not computations.
// - Member access is left-associative: a.b.c → Member(Member(Ident(a), b), c).
// - Null propagation happens at evaluation time, not parse time.
/** Reserved keywords that are tokenized as their own kind, not as identifiers. */
const KEYWORDS = new Set(['and', 'or', 'not', 'true', 'false', 'null']);
/**
 * Tokenize an expression string into a flat token list.
 *
 * Returns a Result rather than throwing — callers get structured errors
 * with position information for diagnostics.
 */
export function tokenize(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
        // Skip whitespace
        if (input[i] === ' ' || input[i] === '\t' || input[i] === '\n' || input[i] === '\r') {
            i++;
            continue;
        }
        const ch = input[i];
        // Single-character tokens
        if (ch === '(' || ch === ')' || ch === '.' || ch === ',') {
            tokens.push({ kind: ch, value: ch, pos: i });
            i++;
            continue;
        }
        // Two-character comparison operators (must check before single-char)
        if (ch === '=' && input[i + 1] === '=') {
            tokens.push({ kind: '==', value: '==', pos: i });
            i += 2;
            continue;
        }
        if (ch === '!' && input[i + 1] === '=') {
            tokens.push({ kind: '!=', value: '!=', pos: i });
            i += 2;
            continue;
        }
        if (ch === '<' && input[i + 1] === '=') {
            tokens.push({ kind: '<=', value: '<=', pos: i });
            i += 2;
            continue;
        }
        if (ch === '>' && input[i + 1] === '=') {
            tokens.push({ kind: '>=', value: '>=', pos: i });
            i += 2;
            continue;
        }
        // Single-character comparison operators
        if (ch === '<') {
            tokens.push({ kind: '<', value: '<', pos: i });
            i++;
            continue;
        }
        if (ch === '>') {
            tokens.push({ kind: '>', value: '>', pos: i });
            i++;
            continue;
        }
        // String literals — single or double quoted
        if (ch === "'" || ch === '"') {
            const quote = ch;
            const start = i;
            i++; // skip opening quote
            let str = '';
            while (i < input.length && input[i] !== quote) {
                // Simple escape handling: \' \" \\ \n \t
                if (input[i] === '\\' && i + 1 < input.length) {
                    const next = input[i + 1];
                    if (next === quote || next === '\\') {
                        str += next;
                        i += 2;
                        continue;
                    }
                    if (next === 'n') {
                        str += '\n';
                        i += 2;
                        continue;
                    }
                    if (next === 't') {
                        str += '\t';
                        i += 2;
                        continue;
                    }
                    // Unknown escape — include the backslash literally
                    str += input[i];
                    i++;
                    continue;
                }
                str += input[i];
                i++;
            }
            if (i >= input.length) {
                return { ok: false, error: `Unterminated string starting at position ${start}` };
            }
            i++; // skip closing quote
            tokens.push({ kind: 'string', value: str, pos: start });
            continue;
        }
        // Numbers — integer or float, no leading sign (negative is not supported as
        // a literal; use `0 - x` or a unary minus if ever needed)
        if (ch >= '0' && ch <= '9') {
            const start = i;
            while (i < input.length && input[i] >= '0' && input[i] <= '9')
                i++;
            if (i < input.length && input[i] === '.') {
                i++;
                while (i < input.length && input[i] >= '0' && input[i] <= '9')
                    i++;
            }
            tokens.push({ kind: 'number', value: input.slice(start, i), pos: start });
            continue;
        }
        // Identifiers and keywords
        if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
            const start = i;
            while (i < input.length &&
                ((input[i] >= 'a' && input[i] <= 'z') ||
                    (input[i] >= 'A' && input[i] <= 'Z') ||
                    (input[i] >= '0' && input[i] <= '9') ||
                    input[i] === '_')) {
                i++;
            }
            const word = input.slice(start, i);
            // Keywords get their own token kind; everything else is an identifier
            const kind = KEYWORDS.has(word)
                ? word
                : 'ident';
            tokens.push({ kind, value: word, pos: start });
            continue;
        }
        return { ok: false, error: `Unexpected character '${ch}' at position ${i}` };
    }
    tokens.push({ kind: 'eof', value: '', pos: i });
    return { ok: true, tokens };
}
/**
 * Parse an expression string into an ExpressionNode AST.
 *
 * Entry point for the expression system — called by the evaluator and the
 * validate method.
 */
export function parse(input) {
    const tokenResult = tokenize(input);
    if (!tokenResult.ok)
        return tokenResult;
    const tokens = tokenResult.tokens;
    let pos = 0;
    function peek() {
        return tokens[pos];
    }
    function advance() {
        const tok = tokens[pos];
        pos++;
        return tok;
    }
    function expect(kind) {
        if (peek().kind !== kind)
            return null;
        return advance();
    }
    // ---- Grammar rules (precedence low→high) ----
    function parseExpr() {
        return parseOr();
    }
    function parseOr() {
        let result = parseAnd();
        if (!result.ok)
            return result;
        let left = result.node;
        while (peek().kind === 'or') {
            advance(); // consume 'or'
            const right = parseAnd();
            if (!right.ok)
                return right;
            left = { kind: 'binary', op: 'or', left, right: right.node };
        }
        return { ok: true, node: left };
    }
    function parseAnd() {
        let result = parseNot();
        if (!result.ok)
            return result;
        let left = result.node;
        while (peek().kind === 'and') {
            advance(); // consume 'and'
            const right = parseNot();
            if (!right.ok)
                return right;
            left = { kind: 'binary', op: 'and', left, right: right.node };
        }
        return { ok: true, node: left };
    }
    function parseNot() {
        if (peek().kind === 'not') {
            advance(); // consume 'not'
            const operand = parseNot(); // right-associative: not not x
            if (!operand.ok)
                return operand;
            return { ok: true, node: { kind: 'unary', op: 'not', operand: operand.node } };
        }
        return parseCompare();
    }
    /**
     * Map source-level operators to the BinaryOp enum values.
     *
     * The AST uses semantic names ('eq', 'neq') rather than symbols because the
     * AST is serializable and more readable in logs/diagnostics.
     */
    const COMPARE_OPS = {
        '==': 'eq',
        '!=': 'neq',
        '<': 'lt',
        '<=': 'lte',
        '>': 'gt',
        '>=': 'gte',
    };
    function parseCompare() {
        let result = parseMember();
        if (!result.ok)
            return result;
        const left = result.node;
        const tok = peek();
        const op = COMPARE_OPS[tok.kind];
        if (op) {
            advance();
            const right = parseMember();
            if (!right.ok)
                return right;
            return { ok: true, node: { kind: 'binary', op, left, right: right.node } };
        }
        return { ok: true, node: left };
    }
    function parseMember() {
        let result = parseCallOrPrimary();
        if (!result.ok)
            return result;
        let node = result.node;
        while (peek().kind === '.') {
            advance(); // consume '.'
            const ident = expect('ident');
            if (!ident) {
                return { ok: false, error: `Expected identifier after '.' at position ${peek().pos}` };
            }
            node = { kind: 'member', object: node, property: ident.value };
        }
        return { ok: true, node };
    }
    function parseCallOrPrimary() {
        // Look ahead: IDENT '(' means function call
        if (peek().kind === 'ident' && pos + 1 < tokens.length && tokens[pos + 1].kind === '(') {
            const name = advance(); // consume identifier
            advance(); // consume '('
            const args = [];
            if (peek().kind !== ')') {
                const first = parseExpr();
                if (!first.ok)
                    return first;
                args.push(first.node);
                while (peek().kind === ',') {
                    advance(); // consume ','
                    const arg = parseExpr();
                    if (!arg.ok)
                        return arg;
                    args.push(arg.node);
                }
            }
            if (!expect(')')) {
                return { ok: false, error: `Expected ')' at position ${peek().pos}` };
            }
            return {
                ok: true,
                node: {
                    kind: 'call',
                    callee: { kind: 'identifier', name: name.value },
                    args,
                },
            };
        }
        return parsePrimary();
    }
    function parsePrimary() {
        const tok = peek();
        // Parenthesized expression
        if (tok.kind === '(') {
            advance();
            const inner = parseExpr();
            if (!inner.ok)
                return inner;
            if (!expect(')')) {
                return { ok: false, error: `Expected ')' at position ${peek().pos}` };
            }
            return inner;
        }
        // Literals
        if (tok.kind === 'string') {
            advance();
            return { ok: true, node: { kind: 'literal', value: tok.value } };
        }
        if (tok.kind === 'number') {
            advance();
            return { ok: true, node: { kind: 'literal', value: Number(tok.value) } };
        }
        if (tok.kind === 'true') {
            advance();
            return { ok: true, node: { kind: 'literal', value: true } };
        }
        if (tok.kind === 'false') {
            advance();
            return { ok: true, node: { kind: 'literal', value: false } };
        }
        if (tok.kind === 'null') {
            advance();
            return { ok: true, node: { kind: 'literal', value: null } };
        }
        // Identifier
        if (tok.kind === 'ident') {
            advance();
            return { ok: true, node: { kind: 'identifier', name: tok.value } };
        }
        return { ok: false, error: `Unexpected token '${tok.value}' at position ${tok.pos}` };
    }
    // ---- Run the parser ----
    const result = parseExpr();
    if (!result.ok)
        return result;
    // Ensure we consumed all tokens
    if (peek().kind !== 'eof') {
        const leftover = peek();
        return { ok: false, error: `Unexpected token '${leftover.value}' at position ${leftover.pos}` };
    }
    return result;
}
//# sourceMappingURL=parser.js.map