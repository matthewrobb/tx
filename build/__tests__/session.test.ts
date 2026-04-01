// build/__tests__/session.test.ts
import { describe, it, expect } from "bun:test";
import { createSession, addSessionEvent, closeSession, getLatestSession } from "../../src/session/lifecycle.ts";
import type { ActiveSession } from "../../types/session";

describe("session lifecycle", () => {
  it("createSession returns active session", () => {
    const session = createSession("plan", null, 1);
    expect(session.number).toBe(1);
    expect(session.step_started).toBe("plan");
    expect(session.name).toBeNull();
    expect(session.notes_added).toEqual([]);
    expect(session.artifacts_created).toEqual([]);
    expect(session.steps_advanced).toEqual([]);
  });

  it("createSession with name", () => {
    const session = createSession("research", "initial-exploration", 1);
    expect(session.name).toBe("initial-exploration");
  });

  it("addSessionEvent tracks note ids", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "note_added", noteId: 3 });
    addSessionEvent(session, { type: "note_added", noteId: 4 });
    expect(session.notes_added).toEqual([3, 4]);
  });

  it("addSessionEvent tracks artifacts", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "artifact_created", artifact: "scope.md" });
    expect(session.artifacts_created).toEqual(["scope.md"]);
  });

  it("addSessionEvent tracks step advances", () => {
    const session = createSession("scope", null, 1);
    addSessionEvent(session, { type: "step_advanced", step: "plan" });
    expect(session.steps_advanced).toEqual(["plan"]);
  });

  it("closeSession generates summary metadata", () => {
    const session = createSession("scope", "scoping", 3);
    const result = closeSession(session);
    expect(result.number).toBe(3);
    expect(result.name).toBe("scoping");
    expect(result.file).toBe("003-scoping.md");
  });

  it("closeSession without name uses step", () => {
    const session = createSession("plan", null, 2);
    const result = closeSession(session);
    expect(result.file).toBe("002-plan.md");
  });

  it("getLatestSession returns highest number", () => {
    const sessions = [
      { number: 1, name: "a", file: "001-a.md" },
      { number: 3, name: "c", file: "003-c.md" },
      { number: 2, name: "b", file: "002-b.md" },
    ];
    expect(getLatestSession(sessions)?.number).toBe(3);
  });
});
