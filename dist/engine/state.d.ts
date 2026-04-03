import type { StoragePort } from '../ports/storage.js';
import type { ProjectionPort } from '../ports/projection.js';
import type { IssueState, AgentAction } from '../types/protocol.js';
export interface TxNextInput {
    issue_slug: string;
    /** Response to a previous paused interactive expression (confirm/prompt/choose). */
    resume_response?: string;
}
export type TxNextResult = {
    status: 'advanced';
    issue: IssueState;
    from_step: string;
    to_step: string;
} | {
    status: 'done';
    issue: IssueState;
} | {
    status: 'blocked';
    issue: IssueState;
    step: string;
} | {
    status: 'paused';
    issue: IssueState;
    action: AgentAction;
} | {
    status: 'no_change';
    issue: IssueState;
} | {
    status: 'error';
    message: string;
};
export declare function txNext(db: StoragePort, projection: ProjectionPort, input: TxNextInput): Promise<TxNextResult>;
//# sourceMappingURL=state.d.ts.map