import type { ExpressionNode } from '../../types/expressions.js';
export type TokenKind = 'string' | 'number' | 'true' | 'false' | 'null' | 'ident' | 'and' | 'or' | 'not' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '(' | ')' | '.' | ',' | 'eof';
export interface Token {
    kind: TokenKind;
    value: string;
    pos: number;
}
export type TokenizeResult = {
    ok: true;
    tokens: Token[];
} | {
    ok: false;
    error: string;
};
/**
 * Tokenize an expression string into a flat token list.
 *
 * Returns a Result rather than throwing — callers get structured errors
 * with position information for diagnostics.
 */
export declare function tokenize(input: string): TokenizeResult;
export type ParseResult = {
    ok: true;
    node: ExpressionNode;
} | {
    ok: false;
    error: string;
};
/**
 * Parse an expression string into an ExpressionNode AST.
 *
 * Entry point for the expression system — called by the evaluator and the
 * validate method.
 */
export declare function parse(input: string): ParseResult;
//# sourceMappingURL=parser.d.ts.map