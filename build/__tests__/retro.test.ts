// build/__tests__/retro.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { aggregateRetro, writeRetro, readCandidates, promoteCandidateById } from "../../src/engine/retro.js";
import type { Note } from "../../src/types/notes.js";

const TMP = join(import.meta.dirname, "../.test-output/retro");

function makeNotes(notes: Partial<Note>[]): Note[] {
  return notes.map((n, i) => ({
    id: i + 1,
    type: "note",
    step: "build",
    summary: `Note ${i + 1}`,
    created: "2026-04-01T00:00:00Z",
    ...n,
  }));
}

describe("aggregateRetro", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("returns empty retro when no notes", () => {
    const { retro, candidates, retroMd } = aggregateRetro(TMP, "test-epic");
    expect(retro).toHaveLength(0);
    expect(candidates).toHaveLength(0);
    expect(retroMd).toContain("test-epic");
  });

  it("extracts retro-typed notes", () => {
    const notes = makeNotes([
      { type: "retro", summary: "Carried over learning" },
      { type: "decision", summary: "Used tsx over ts-node" },
    ]);
    writeFileSync(join(TMP, "notes.json"), JSON.stringify(notes));
    const { retro } = aggregateRetro(TMP, "test-epic");
    expect(retro).toHaveLength(1);
    expect(retro[0]!.summary).toBe("Carried over learning");
    expect(retro[0]!.id).toMatch(/^R-/);
  });

  it("converts deferral notes to backlog candidates", () => {
    const notes = makeNotes([
      { type: "deferral", summary: "Add caching layer later" },
    ]);
    writeFileSync(join(TMP, "notes.json"), JSON.stringify(notes));
    const { candidates } = aggregateRetro(TMP, "test-epic");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.summary).toBe("Add caching layer later");
    expect(candidates[0]!.id).toMatch(/^BC-/);
    expect(candidates[0]!.promoted).toBe(false);
  });

  it("includes decisions in retro.md", () => {
    const notes = makeNotes([
      { type: "decision", summary: "Use NodeNext modules", reason: "ESM compatibility" },
    ]);
    writeFileSync(join(TMP, "notes.json"), JSON.stringify(notes));
    const { retroMd } = aggregateRetro(TMP, "test-epic");
    expect(retroMd).toContain("Use NodeNext modules");
    expect(retroMd).toContain("ESM compatibility");
  });
});

describe("writeRetro", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("writes retro.md to epicDir", () => {
    writeRetro(TMP, "my-epic");
    expect(existsSync(join(TMP, "retro.md"))).toBe(true);
  });

  it("writes backlog-candidates.json when deferrals exist", () => {
    const notes = makeNotes([{ type: "deferral", summary: "Do later" }]);
    writeFileSync(join(TMP, "notes.json"), JSON.stringify(notes));
    writeRetro(TMP, "my-epic");
    expect(existsSync(join(TMP, "backlog-candidates.json"))).toBe(true);
  });
});

describe("promoteCandidateById", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("marks a candidate as promoted", () => {
    const notes = makeNotes([{ type: "deferral", summary: "Future work" }]);
    writeFileSync(join(TMP, "notes.json"), JSON.stringify(notes));
    writeRetro(TMP, "my-epic");

    const candidates = readCandidates(TMP);
    expect(candidates[0]!.promoted).toBe(false);

    const updated = promoteCandidateById(TMP, candidates[0]!.id);
    expect(updated[0]!.promoted).toBe(true);

    // Verify persisted
    const reloaded = readCandidates(TMP);
    expect(reloaded[0]!.promoted).toBe(true);
  });
});
