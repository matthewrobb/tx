// build/__tests__/stories.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import {
  createStory, markStoryDone, findStory, buildStoriesFile, formatStory,
} from "../../src/stories/stories.js";
import { readStories, writeStories } from "../../src/cli/fs.js";
import type { Story } from "../../src/types/stories.js";

const TMP = join(import.meta.dirname, "../.test-output/stories");
const TEST_DIR = join(import.meta.dirname, "../.test-output/stories-cli");
const PROJECT_ROOT = join(import.meta.dirname, "../..");
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");
const NODE = process.execPath;
const TSX_LOADER = ["--import", "tsx"];

function run(args: string[], dir = TEST_DIR) {
  return spawnSync(NODE, [...TSX_LOADER, CLI_PATH, ...args, "-a"], {
    cwd: dir,
    env: { ...process.env, TWISTED_ROOT: dir },
  });
}
function parseOut(r: ReturnType<typeof spawnSync>) {
  return JSON.parse(r.stdout.toString());
}

describe("stories CRUD (unit)", () => {
  beforeEach(() => mkdirSync(TMP, { recursive: true }));
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  it("createStory assigns sequential IDs", () => {
    const s1 = createStory([], "First story");
    const s2 = createStory([s1], "Second story");
    expect(s1.id).toBe("S-001");
    expect(s2.id).toBe("S-002");
  });

  it("createStory sets done=false and empty acceptance", () => {
    const s = createStory([], "Test");
    expect(s.done).toBe(false);
    expect(s.acceptance).toEqual([]);
  });

  it("createStory stores acceptance criteria", () => {
    const s = createStory([], "Test", ["criterion 1", "criterion 2"]);
    expect(s.acceptance).toHaveLength(2);
  });

  it("markStoryDone marks the target story", () => {
    const s1 = createStory([], "First");
    const s2 = createStory([s1], "Second");
    const updated = markStoryDone([s1, s2], "S-001");
    expect(updated[0]!.done).toBe(true);
    expect(updated[1]!.done).toBe(false);
  });

  it("findStory returns story by ID", () => {
    const s = createStory([], "Target");
    expect(findStory([s], "S-001")?.summary).toBe("Target");
    expect(findStory([s], "S-999")).toBeUndefined();
  });

  it("formatStory shows done/undone prefix", () => {
    const done = { id: "S-001", summary: "A story", done: true, acceptance: [], created: "2026-04-01" };
    const notDone = { ...done, done: false };
    expect(formatStory(done)).toContain("[x]");
    expect(formatStory(notDone)).toContain("[ ]");
  });

  it("readStories/writeStories round-trip", () => {
    const story = createStory([], "Persisted story");
    const file = buildStoriesFile("my-epic", [story]);
    writeStories(TMP, file);

    const loaded = readStories(TMP);
    expect(loaded?.stories).toHaveLength(1);
    expect(loaded?.stories[0]!.summary).toBe("Persisted story");
    expect(loaded?.epic).toBe("my-epic");
  });

  it("readStories returns null when no file", () => {
    expect(readStories(TMP)).toBeNull();
  });
});

describe("tx stories (CLI)", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    run(["init", "-y"]);
    run(["open", "--name", "my-epic", "--description", "Test epic"]);
  });
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it("lists empty stories", () => {
    const r = parseOut(run(["stories", "my-epic"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("No stories");
  });

  it("adds a story", () => {
    const r = parseOut(run(["stories", "my-epic", "add", "User can login"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("S-001");
    expect(r.display).toContain("User can login");
  });

  it("lists stories after add", () => {
    run(["stories", "my-epic", "add", "First story"]);
    run(["stories", "my-epic", "add", "Second story"]);
    const r = parseOut(run(["stories", "my-epic"]));
    expect(r.display).toContain("S-001");
    expect(r.display).toContain("S-002");
  });

  it("returns error for unknown epic", () => {
    const r = parseOut(run(["stories", "ghost-epic"]));
    expect(r.status).toBe("error");
  });
});
