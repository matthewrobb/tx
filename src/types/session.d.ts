// types/session.d.ts

/** An action that occurred during a session. */
export interface SessionAction {
  type: "note" | "task" | "artifact" | "step" | "story";
  summary: string;
  timestamp: string;
}

/** Active session tracking — written to sessions/active.json. */
export interface ActiveSession {
  number: number;
  name: string | null;
  step_started: string;
  started: string;
  ended?: string;
  actions: SessionAction[];
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
