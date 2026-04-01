// types/engine.d.ts

/** Evaluation status of a single step. */
export type StepStatus = "pending" | "ready" | "active" | "complete" | "blocked";

/** Result of evaluating one step's entry/exit conditions. */
export interface StepEvaluation {
  step: string;
  lane: string;
  status: StepStatus;
  /** True when all required artifacts and predicates are satisfied. */
  satisfied: boolean;
  /** Artifact paths or predicate names that are not yet satisfied. */
  missing?: string[];
}

/** What the engine decided to do after evaluation. */
export type EngineAction = "advance" | "wait" | "complete" | "error";

/** Result returned by the engine after a run. */
export interface EngineResult {
  action: EngineAction;
  from_lane?: string;
  to_lane?: string;
  from_step?: string;
  to_step?: string;
  message?: string;
  evaluation?: StepEvaluation[];
}
