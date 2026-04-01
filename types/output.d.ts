// types/output.d.ts
import type { ObjectiveState } from "./state";
import type { TwistedConfig } from "./config";

/** What --agent mode returns for every command. */
export interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  state?: ObjectiveState;
  config?: TwistedConfig;
  error?: string;
  session?: import("./session").SessionData;
}

export type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: import("./tasks").AgentAssignment[] }
  | { type: "install_cli"; instructions: string };
