// build/__tests__/engine-machine.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createActor } from "xstate";
import { epicMachine } from "../../src/engine/machine.js";
import { saveSnapshot, loadSnapshot } from "../../src/engine/persist.js";
import type { EpicContext } from "../../types/xstate.js";

const TMP = join(import.meta.dirname, "../.test-output/engine-machine");

const baseContext: EpicContext = {
  state: {
    epic: "test-epic",
    type: "feature",
    lane: "2-active",
    step: "research",
    status: "active",
    tasks_done: 0,
    tasks_total: null,
    created: "2026-04-01",
    updated: "2026-04-01T00:00:00Z",
  },
};

describe("epicMachine transitions", () => {
  it("starts in active state", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    expect(actor.getSnapshot().value).toBe("active");
    actor.stop();
  });

  it("transitions to blocked on BLOCK event", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "BLOCK", reason: "missing artifacts" });
    expect(actor.getSnapshot().value).toBe("blocked");
    actor.stop();
  });

  it("transitions from blocked back to active on ADVANCE", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "BLOCK", reason: "missing" });
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().value).toBe("active");
    actor.stop();
  });

  it("transitions to complete on COMPLETE event", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "COMPLETE" });
    expect(actor.getSnapshot().value).toBe("complete");
    actor.stop();
  });

  it("transitions to error on ERROR event", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "ERROR", error: "something went wrong" });
    expect(actor.getSnapshot().value).toBe("error");
    actor.stop();
  });

  it("recovers from error to active on ADVANCE", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "ERROR", error: "oops" });
    actor.send({ type: "ADVANCE" });
    expect(actor.getSnapshot().value).toBe("active");
    actor.stop();
  });
});

describe("epicMachine persistence", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("saves and restores snapshot", () => {
    const actor = createActor(epicMachine, { input: baseContext });
    actor.start();
    actor.send({ type: "BLOCK", reason: "waiting" });

    const snapshot = actor.getSnapshot();
    saveSnapshot(TMP, snapshot);
    actor.stop();

    // Verify snapshot file exists
    const loaded = loadSnapshot(TMP);
    expect(loaded).not.toBeNull();

    // Restore from snapshot
    const actor2 = createActor(epicMachine, { snapshot: loaded! });
    actor2.start();
    expect(actor2.getSnapshot().value).toBe("blocked");
    actor2.stop();
  });

  it("loadSnapshot returns null when no snapshot exists", () => {
    expect(loadSnapshot(TMP)).toBeNull();
  });
});
