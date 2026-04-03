import type { ExpressionContext } from '../types/expressions.js';
import type { AgentAction } from '../types/protocol.js';
import type { PolicyHook, PolicyConfig } from '../types/config.js';
export type PolicyOutcome = 'allow' | 'require_approval' | 'block';
export interface PolicyResult {
    outcome: PolicyOutcome;
    policy_name: string;
    /** Only present when outcome === 'require_approval'. */
    action?: AgentAction;
    /** Only present when outcome === 'block'. */
    reason?: string;
}
export declare class PolicyEngine {
    private readonly policies;
    private readonly evaluator;
    constructor(policies: PolicyConfig);
    /**
     * Evaluate a policy hook against a context.
     *
     * Returns 'allow' if no policy is configured for the hook.
     */
    evaluate(hook: PolicyHook, context: ExpressionContext): PolicyResult;
}
//# sourceMappingURL=policies.d.ts.map