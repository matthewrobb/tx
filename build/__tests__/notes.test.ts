// build/__tests__/notes.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { addNote, getNotes, filterNotes } from "../../src/notes/notes.ts";
import type { Note } from "../../types/notes";

describe("notes", () => {
  let notes: Note[];

  beforeEach(() => {
    notes = [];
  });

  it("addNote creates a note with auto-incrementing id", () => {
    const note = addNote(notes, { type: "note", step: "research", summary: "test note" });
    expect(note.id).toBe(1);
    expect(note.type).toBe("note");
    expect(note.summary).toBe("test note");
    expect(notes).toHaveLength(1);
  });

  it("addNote increments id from existing notes", () => {
    addNote(notes, { type: "note", step: "research", summary: "first" });
    const second = addNote(notes, { type: "decision", step: "scope", summary: "second" });
    expect(second.id).toBe(2);
  });

  it("filterNotes by type", () => {
    addNote(notes, { type: "note", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "scope", summary: "b" });
    addNote(notes, { type: "note", step: "plan", summary: "c" });
    expect(filterNotes(notes, { type: "decision" })).toHaveLength(1);
    expect(filterNotes(notes, { type: "note" })).toHaveLength(2);
  });

  it("filterNotes by step", () => {
    addNote(notes, { type: "note", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "research", summary: "b" });
    addNote(notes, { type: "note", step: "scope", summary: "c" });
    expect(filterNotes(notes, { step: "research" })).toHaveLength(2);
  });

  it("filterNotes by type and step", () => {
    addNote(notes, { type: "decision", step: "research", summary: "a" });
    addNote(notes, { type: "decision", step: "scope", summary: "b" });
    addNote(notes, { type: "note", step: "research", summary: "c" });
    expect(filterNotes(notes, { type: "decision", step: "research" })).toHaveLength(1);
  });
});
