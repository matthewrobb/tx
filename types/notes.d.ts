// types/notes.d.ts

export type NoteType = "note" | "decision" | "deferral" | "discovery" | "blocker";

export interface Note {
  id: number;
  type: NoteType;
  step: import("./state").ObjectiveStep;
  summary: string;
  reason?: string;
  impact?: string;
  created: string;
}
