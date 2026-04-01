// types/output.d.ts
import type { CoreState } from "./state";

/** What --agent mode returns for every command. */
export interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  /** v3 state (kept for compatibility during migration). */
  state?: Record<string, unknown>;
  /** v4 epic state. */
  epic?: CoreState;
  config?: Record<string, unknown>;
  error?: string;
  session?: import("./session").SessionData;
}

export type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: AgentAssignmentV4[] }
  | { type: "install_cli"; instructions: string };

/** v4 agent assignment with richer targeting. */
export interface AgentAssignmentV4 {
  id: string;
  epic: string;
  tasks: string[];
  prompt?: string;
}
