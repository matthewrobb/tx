// src/session/lifecycle.ts
import type { ActiveSession, SessionSummary } from "../../types/session.js";
import type { ObjectiveStep } from "../../types/state.js";

type SessionEvent =
  | { type: "note_added"; noteId: number }
  | { type: "artifact_created"; artifact: string }
  | { type: "step_advanced"; step: ObjectiveStep };

export function createSession(
  step: ObjectiveStep,
  name: string | null,
  number: number,
): ActiveSession {
  return {
    number,
    name,
    step_started: step,
    started: new Date().toISOString(),
    notes_added: [],
    artifacts_created: [],
    steps_advanced: [],
  };
}

export function addSessionEvent(session: ActiveSession, event: SessionEvent): void {
  switch (event.type) {
    case "note_added":
      session.notes_added.push(event.noteId);
      break;
    case "artifact_created":
      session.artifacts_created.push(event.artifact);
      break;
    case "step_advanced":
      session.steps_advanced.push(event.step);
      break;
  }
}

export function closeSession(session: ActiveSession): SessionSummary {
  const name = session.name ?? session.step_started;
  const paddedNumber = String(session.number).padStart(3, "0");
  return {
    number: session.number,
    name,
    file: `${paddedNumber}-${name}.md`,
  };
}

export function getLatestSession(sessions: SessionSummary[]): SessionSummary | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.number > latest.number ? s : latest));
}
