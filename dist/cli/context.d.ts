import type { TwistedConfig, AgentResponse, CoreState, SessionAction } from "../types/index.js";
export interface CliContext {
    root: string;
    config: TwistedConfig;
    respond: (r: AgentResponse) => void;
    findActiveEpic: () => {
        dir: string;
        epicName: string;
        state: CoreState;
    } | null;
    readStdin: () => Promise<string>;
    /** Ensure an active session exists for the epic dir. Creates one if needed. */
    ensureSession: (epicDir: string, step: string) => void;
    /** Log an action to the active session. */
    logAction: (epicDir: string, action: SessionAction) => void;
}
//# sourceMappingURL=context.d.ts.map