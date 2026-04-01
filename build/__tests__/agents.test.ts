// build/__tests__/agents.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { createAgentSymlink, removeAgentSymlink, syncAgentSymlinks, agentsDir } from "../../src/agents/generate.js";
import type { CoreState } from "../../types/state.js";

const TMP = join(import.meta.dirname, "../.test-output/agents");

function makeEpicDir(name: string, laneDir: string): string {
  const dir = join(TMP, ".twisted", laneDir, name);
  mkdirSync(dir, { recursive: true });
  const state: CoreState = {
    epic: name, type: "feature", lane: laneDir, step: "research",
    status: "active", tasks_done: 0, tasks_total: null,
    created: "2026-04-01", updated: "2026-04-01T00:00:00Z",
  };
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2));
  return dir;
}

describe("createAgentSymlink", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("creates symlink in .claude/agents/", () => {
    const epicDir = makeEpicDir("my-epic", "2-active");
    createAgentSymlink(TMP, "my-epic", epicDir);
    const target = join(agentsDir(TMP), "my-epic");
    expect(existsSync(target)).toBe(true);
  });

  it("replaces existing symlink", () => {
    const dir1 = makeEpicDir("my-epic", "2-active");
    const dir2 = makeEpicDir("my-epic-v2", "4-done");
    createAgentSymlink(TMP, "my-epic", dir1);
    createAgentSymlink(TMP, "my-epic", dir2);
    const target = join(agentsDir(TMP), "my-epic");
    expect(existsSync(target)).toBe(true);
  });
});

describe("removeAgentSymlink", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("removes existing symlink", () => {
    const epicDir = makeEpicDir("rm-epic", "2-active");
    createAgentSymlink(TMP, "rm-epic", epicDir);
    removeAgentSymlink(TMP, "rm-epic");
    expect(existsSync(join(agentsDir(TMP), "rm-epic"))).toBe(false);
  });

  it("is a no-op when symlink does not exist", () => {
    expect(() => removeAgentSymlink(TMP, "nonexistent")).not.toThrow();
  });
});

describe("syncAgentSymlinks", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("creates symlinks for all provided epics", () => {
    const dir1 = makeEpicDir("epic-a", "2-active");
    const dir2 = makeEpicDir("epic-b", "2-active");

    syncAgentSymlinks(TMP, [
      { epic: "epic-a", dir: dir1 },
      { epic: "epic-b", dir: dir2 },
    ]);

    expect(existsSync(join(agentsDir(TMP), "epic-a"))).toBe(true);
    expect(existsSync(join(agentsDir(TMP), "epic-b"))).toBe(true);
  });

  it("handles empty list without error", () => {
    expect(() => syncAgentSymlinks(TMP, [])).not.toThrow();
  });
});
