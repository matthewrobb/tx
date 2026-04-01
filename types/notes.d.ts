// types/notes.d.ts

export type NoteType = "note" | "decision" | "deferral" | "discovery" | "blocker" | "retro";

export interface Note {
  id: number;
  type: NoteType;
  step: import("./state").ObjectiveStep;
  summary: string;
  reason?: string;
  impact?: string;
  created: string;
}

// --- v4 retro types (P2-04) ---

/**
 * A retro note aggregated at close time.
 * Retro notes summarize what went well, what didn't, and what to carry forward.
 */
export interface RetroNote {
  id: string;
  epic: string;
  summary: string;
  category: "went-well" | "went-wrong" | "carry-forward";
  created: string;
}

/**
 * A candidate for the backlog, promoted from a retro note.
 * Represents a follow-up epic or task that came out of the retrospective.
 */
export interface BacklogCandidate {
  id: string;
  source_note_id: string;
  summary: string;
  suggested_type: import("./epic").EpicType;
  promoted: boolean;
  created: string;
}
