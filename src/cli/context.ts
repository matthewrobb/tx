// src/cli/context.ts
import type { TwistedConfig, AgentResponse } from "../types/index.js";
import type { CoreState } from "../types/index.js";

export interface CliContext {
  root: string;
  config: TwistedConfig;
  respond: (r: AgentResponse) => void;
  findActiveEpic: () => { dir: string; epicName: string; state: CoreState } | null;
  readStdin: () => Promise<string>;
}
