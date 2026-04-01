// build/__tests__/promote.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { promoteEpic } from "../../src/engine/promote.js";
import { defaultsV4 } from "../../src/config/defaults.js";
import type { CoreState } from "../../types/state.js";

const TMP = join(import.meta.dirname, "../.test-output/promote");
const TWISTED = join(TMP, ".twisted");

function createEpic(name: string, laneDir: string, state: Partial<CoreState> = {}): string {
  const dir = join(TWISTED, laneDir, name);
  mkdirSync(dir, { recursive: true });
  const coreState: CoreState = {
    epic: name,
    type: "spike",
    lane: laneDir,
    step: "research",
    status: "active",
    tasks_done: 0,
    tasks_total: null,
    created: "2026-04-01",
    updated: "2026-04-01T00:00:00Z",
    ...state,
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(coreState, null, 2));
  return dir;
}

describe("promoteEpic", () => {
  beforeEach(() => mkdirSync(TWISTED, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("promotes a spike to feature and moves to backlog", () => {
    createEpic("my-spike", "0-backlog");

    const result = promoteEpic(TMP, "my-spike", "feature", defaultsV4);

    expect(result.from_type).toBe("spike");
    expect(result.to_type).toBe("feature");
    expect(result.from_lane).toBe("0-backlog");
    // feature starts in 0-backlog per defaultsV4 type config
    expect(result.to_lane).toBe("0-backlog");
    expect(result.state.type).toBe("feature");
  });

  it("promotes a spike in active lane to chore (moves to backlog)", () => {
    createEpic("my-spike", "2-active");

    const result = promoteEpic(TMP, "my-spike", "chore", defaultsV4);

    expect(result.to_type).toBe("chore");
    // chore starts in 0-backlog
    expect(result.to_lane).toBe("0-backlog");
    // old dir should be gone
    expect(existsSync(join(TWISTED, "2-active", "my-spike"))).toBe(false);
    // new dir should exist
    expect(existsSync(join(TWISTED, "0-backlog", "my-spike"))).toBe(true);
  });

  it("throws when epic is not found", () => {
    expect(() => promoteEpic(TMP, "ghost-epic", "feature", defaultsV4)).toThrow("not found");
  });

  it("throws when epic is not a spike", () => {
    createEpic("my-feature", "0-backlog", { type: "feature" });
    expect(() => promoteEpic(TMP, "my-feature", "chore", defaultsV4)).toThrow("not a spike");
  });
});
