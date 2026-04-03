/**
 * XState v5 machine generator — builds a state machine from a Workflow definition.
 *
 * The machine is created once at load time from the workflow's step DAG.
 * It tracks which step an issue is on and enforces valid transitions
 * based on dependency ordering. It does NOT evaluate expressions or
 * query the DB — that responsibility belongs to the evaluator (S-010).
 *
 * Design: Uses a single "active" compound state with guards + assign actions
 * to enforce DAG ordering. Steps advance when STEP_DONE or STEP_SKIP events
 * match the current step. A closure over the resolved DAG determines
 * which step becomes active next (first step whose `needs` are all in
 * `completed_steps`).
 */
import type { IssueStatus } from '../types/index.js';
import type { Workflow } from '../types/index.js';
export type WorkflowEvent = {
    type: 'STEP_DONE';
    step: string;
} | {
    type: 'STEP_SKIP';
    step: string;
} | {
    type: 'STEP_BLOCK';
    step: string;
} | {
    type: 'RESET';
};
export interface WorkflowContext {
    current_step: string;
    completed_steps: string[];
    status: IssueStatus;
}
/**
 * Generate an XState v5 machine from a Workflow definition.
 *
 * Throws if the workflow's step DAG contains cycles or is otherwise invalid.
 */
export declare function generateMachine(workflow: Workflow): import("xstate").StateMachine<WorkflowContext, {
    type: "STEP_DONE";
    step: string;
} | {
    type: "STEP_SKIP";
    step: string;
} | {
    type: "STEP_BLOCK";
    step: string;
} | {
    type: "RESET";
}, {}, never, {
    type: "advanceStep";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "markBlocked";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "resetMachine";
    params: import("xstate").NonReducibleUnknown;
}, {
    type: "isCurrentStep";
    params: unknown;
}, never, "blocked" | "active", string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: `workflow-${string}`;
    states: {
        readonly active: {};
        readonly blocked: {};
    };
}>;
export type WorkflowMachine = ReturnType<typeof generateMachine>;
//# sourceMappingURL=generator.d.ts.map