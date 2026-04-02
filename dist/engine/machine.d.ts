/**
 * XState v5 epic state machine.
 *
 * States: active → (advance) → active | complete | error
 *         active → (block)   → blocked
 *         blocked → (advance) → active
 *
 * The machine does not perform side effects — it tracks state transitions.
 * Persistence (snapshot save/restore) is handled in persist.ts.
 */
import type { EpicContext } from "../types/index.js";
export declare const epicMachine: import("xstate").StateMachine<EpicContext, {
    type: "ADVANCE";
} | {
    type: "BLOCK";
    reason: string;
} | {
    type: "COMPLETE";
} | {
    type: "ERROR";
    error: string;
}, {}, never, {
    type: "setResult";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "setError";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "clearError";
    params: import("xstate").NonReducibleUnknown;
}, never, never, "error" | "active" | "complete" | "blocked", string, EpicContext, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "epic";
    states: {
        readonly active: {};
        readonly blocked: {};
        readonly complete: {};
        readonly error: {};
    };
}>;
export type EpicMachine = typeof epicMachine;
//# sourceMappingURL=machine.d.ts.map