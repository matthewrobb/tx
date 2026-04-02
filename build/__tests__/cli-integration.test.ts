// build/__tests__/cli-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";

const TEST_DIR = join(import.meta.dirname, "../.test-output/cli-integration");
const PROJECT_ROOT = join(import.meta.dirname, "../..");
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");
const NODE = process.execPath;
const TSX_LOADER = ["--import", "tsx"];

function run(args: string[], opts: { env?: Record<string, string>; input?: Buffer } = {}) {
  return spawnSync(NODE, [...TSX_LOADER, CLI_PATH, ...args, "-a"], {
    cwd: TEST_DIR,
    env: { ...process.env, TWISTED_ROOT: TEST_DIR, ...(opts.env ?? {}) },
    input: opts.input,
  });
}

function parse(result: ReturnType<typeof spawnSync>) {
  return JSON.parse(result.stdout.toString());
}

describe("CLI integration", () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it("tx init creates .twisted directory", () => {
    const r = parse(run(["init", "-y"]));
    expect(r.status).toBe("ok");
    expect(r.command).toBe("init");
    expect(existsSync(join(TEST_DIR, ".twisted"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".twisted/settings.json"))).toBe(true);
    // v4 lanes created
    expect(existsSync(join(TEST_DIR, ".twisted/0-backlog"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".twisted/2-active"))).toBe(true);
  });

  it("tx open creates epic in 0-backlog", () => {
    run(["init", "-y"]);
    const r = parse(run(["open", "--name", "my-feature", "--description", "Test feature epic"]));
    expect(r.status).toBe("ok");
    expect(r.epic?.epic).toBe("my-feature");
    expect(r.epic?.lane).toBe("0-backlog");
    expect(r.epic?.type).toBe("feature");

    const statePath = join(TEST_DIR, ".twisted/0-backlog/my-feature/state.json");
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.epic).toBe("my-feature");
    expect(state.lane).toBe("0-backlog");
  });

  it("tx note adds a note", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    const r = parse(run(["note", "Test decision", "--decide", "--reason", "because"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("Test decision");
  });

  it("tx tasks add creates a task", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    const r = parse(run(["tasks", "add", "First task"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("First task");
  });

  it("tx next runs engine on active epic", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    const r = parse(run(["next"]));
    expect(r.status).toBe("ok");
    expect(r.command).toBe("next");
  });

  it("tx error on missing epic", () => {
    run(["init", "-y"]);
    const r = parse(run(["next"]));
    expect(r.status).toBe("error");
  });

  it("tx pickup starts a session", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    const r = parse(run(["pickup", "my-session"]));
    expect(r.status).toBe("ok");
    expect(r.command).toBe("pickup");
    expect(r.session?.active).toBeTruthy();
    expect(r.session?.active?.number).toBe(1);

    const activePath = join(TEST_DIR, ".twisted/0-backlog/my-feature/sessions/active.json");
    expect(existsSync(activePath)).toBe(true);
  });

  it("tx handoff saves session and cleans up active", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    run(["pickup", "my-session"]);

    const handoffR = parse(run(["handoff"]));
    expect(handoffR.status).toBe("ok");
    expect(handoffR.command).toBe("handoff");

    // active.json should be deleted after handoff
    const activePath = join(TEST_DIR, ".twisted/0-backlog/my-feature/sessions/active.json");
    expect(existsSync(activePath)).toBe(false);

    // session .md file should exist
    const sessionsDir = join(TEST_DIR, ".twisted/0-backlog/my-feature/sessions");
    const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBe(1);
    expect(files[0]).toContain("my-session");
  });

  it("tx session list shows saved sessions", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    run(["pickup", "first-session"]);
    run(["handoff"]);

    const r = parse(run(["session", "list"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("first-session");
  });

  it("tx status shows epic", () => {
    run(["init", "-y"]);
    run(["open", "--name", "my-feature", "--description", "Test feature epic"]);
    const r = parse(run(["status"]));
    expect(r.status).toBe("ok");
    expect(r.display).toContain("my-feature");
  });
});
