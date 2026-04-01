// types/session.d.ts

/** Active session tracking — written to sessions/active.json. */
export interface ActiveSession {
  number: number;
  name: string | null;
  step_started: import("./state").ObjectiveStep;
  started: string;
  notes_added: number[];
  artifacts_created: string[];
  steps_advanced: import("./state").ObjectiveStep[];
}

/** Session data returned in AgentResponse. */
export interface SessionData {
  active: ActiveSession | null;
  previous: SessionSummary | null;
}

/** Metadata for a closed session file. */
export interface SessionSummary {
  number: number;
  name: string;
  file: string;
}
