// src/notes/notes.ts
import type { Note, NoteType } from "../../types/notes.js";
import type { ObjectiveStep } from "../../types/state.js";

interface AddNoteInput {
  type: NoteType;
  step: ObjectiveStep;
  summary: string;
  reason?: string;
  impact?: string;
}

interface NoteFilter {
  type?: NoteType;
  step?: ObjectiveStep;
}

export function addNote(notes: Note[], input: AddNoteInput): Note {
  const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
  const note: Note = {
    id: maxId + 1,
    type: input.type,
    step: input.step,
    summary: input.summary,
    reason: input.reason,
    impact: input.impact,
    created: new Date().toISOString(),
  };
  notes.push(note);
  return note;
}

export function getNotes(notes: Note[]): Note[] {
  return notes;
}

export function filterNotes(notes: Note[], filter: NoteFilter): Note[] {
  return notes.filter((n) => {
    if (filter.type && n.type !== filter.type) return false;
    if (filter.step && n.step !== filter.step) return false;
    return true;
  });
}
