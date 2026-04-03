import type { Json } from './issue.js';
import type { CycleId, CycleStatus } from './cycle.js';
import type { IssueState, AgentAction } from './protocol.js';
export interface LiteralNode {
    kind: 'literal';
    value: Json;
}
export interface IdentifierNode {
    kind: 'identifier';
    name: string;
}
export interface MemberNode {
    kind: 'member';
    object: ExpressionNode;
    property: string;
}
export interface CallNode {
    kind: 'call';
    callee: ExpressionNode;
    args: ExpressionNode[];
}
/**
 * Binary operators.
 *
 * We use word-form 'and'/'or' rather than '&&'/'||' because these expressions
 * are authored by humans in YAML/JSON config, where symbolic operators are
 * harder to read and require escaping.
 */
export type BinaryOp = 'and' | 'or' | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
export interface BinaryNode {
    kind: 'binary';
    op: BinaryOp;
    left: ExpressionNode;
    right: ExpressionNode;
}
export interface UnaryNode {
    kind: 'unary';
    op: 'not';
    operand: ExpressionNode;
}
export type ExpressionNode = LiteralNode | IdentifierNode | MemberNode | CallNode | BinaryNode | UnaryNode;
export interface ArtifactContext {
    /** True when every artifact in the step's `produces` list exists. */
    all_present: boolean;
    /** Check whether a specific artifact exists by relative path. */
    exists: (path: string) => boolean;
}
export interface TaskContext {
    /** True when all tasks for the current issue/story are done. */
    all_done: boolean;
    done_count: number;
    total_count: number;
}
export interface CycleContext {
    id: CycleId;
    slug: string;
    status: CycleStatus;
}
/**
 * Full runtime context available to expression evaluation.
 *
 * The evaluator resolves identifiers against this context:
 *   - "artifacts.all_present" -> ctx.artifacts.all_present
 *   - "tasks.done_count"     -> ctx.tasks.done_count
 *   - "issue.type"           -> ctx.issue.type
 *   - "vars.my_flag"         -> ctx.vars["my_flag"]
 */
export interface ExpressionContext {
    /** User-defined variables from step outputs and config. */
    vars: Record<string, Json>;
    /** Current issue state (step, status, type, etc.). */
    issue: IssueState;
    /** Artifact presence/content checks for the current step. */
    artifacts: ArtifactContext;
    /** Task completion state for the current issue. */
    tasks: TaskContext;
    /** Active cycle, if any. null when no cycle is active. */
    cycle: CycleContext | null;
}
/**
 * EvalResult uses a Result pattern instead of throwing.
 *
 * This makes error handling explicit in the engine — a failed expression
 * evaluation (e.g. undefined variable) is a value, not an exception,
 * so the engine can decide how to handle it (block the step, log a warning, etc.).
 *
 * The 'paused' variant signals that evaluation cannot continue until the user
 * responds to an interactive prompt (confirm/prompt/choose). The engine (S-011)
 * detects this result, persists the paused state to the DB, and surfaces the
 * AgentAction to the CLI. Paused results propagate upward like errors — any
 * parent node that receives a paused child immediately returns it.
 */
export type EvalResult = {
    ok: true;
    value: Json;
} | {
    ok: false;
    error: string;
} | {
    ok: 'paused';
    action: AgentAction;
};
//# sourceMappingURL=expressions.d.ts.map