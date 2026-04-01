// types/xstate.d.ts
import type { CoreState } from "./state";
import type { EngineResult } from "./engine";

/** XState machine context for an epic. */
export interface EpicContext {
  state: CoreState;
  result?: EngineResult;
  error?: string;
}

/** XState machine events for epic lifecycle. */
export type EpicEvent =
  | { type: "ADVANCE" }
  | { type: "BLOCK"; reason: string }
  | { type: "COMPLETE" }
  | { type: "ERROR"; error: string };
