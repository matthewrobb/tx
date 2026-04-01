// build/__tests__/cli-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "../.test-output/cli-integration");
const PROJECT_ROOT = join(import.meta.dir, "../..");
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");

describe("CLI integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("tx init creates .twisted directory", async () => {
    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const output = result.stdout.toString();
    const response = JSON.parse(output);
    expect(response.status).toBe("ok");
    expect(response.command).toBe("init");
    expect(existsSync(join(TEST_DIR, ".twisted"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".twisted/settings.json"))).toBe(true);
  });

  it("tx open creates objective", async () => {
    // Init first
    Bun.spawnSync(
      ["bun", "run", CLI_PATH, "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );

    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "open", "my-feature", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const output = result.stdout.toString();
    const response = JSON.parse(output);
    expect(response.status).toBe("ok");
    expect(response.state?.objective).toBe("my-feature");
    expect(response.state?.step).toBe("research");

    const statePath = join(TEST_DIR, ".twisted/todo/my-feature/state.json");
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.step).toBe("research");
  });

  it("tx note adds a note", async () => {
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "note", "Test decision", "--decide", "--reason", "because", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.display).toContain("Test decision");
  });

  it("tx tasks add creates a task", async () => {
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "tasks", "add", "First task", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.display).toContain("First task");
  });

  it("tx next advances pipeline step", async () => {
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "next", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.state?.step).toBe("scope");
  });

  it("tx error on missing objective", async () => {
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "next", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("error");
  });

  it("tx pickup starts a session", async () => {
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], {
      cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR },
    });

    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "pickup", "my-session", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.command).toBe("pickup");
    expect(response.session?.active).toBeTruthy();
    expect(response.session?.active?.number).toBe(1);

    const activePath = join(TEST_DIR, ".twisted/todo/my-feature/sessions/active.json");
    expect(existsSync(activePath)).toBe(true);
  });

  it("tx handoff then session save persists session and cleans up active", async () => {
    const env = { ...process.env, TWISTED_ROOT: TEST_DIR };
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], { cwd: TEST_DIR, env });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], { cwd: TEST_DIR, env });
    Bun.spawnSync(["bun", "run", CLI_PATH, "pickup", "my-session", "-a"], { cwd: TEST_DIR, env });

    const handoffResult = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "handoff", "-a"],
      { cwd: TEST_DIR, env },
    );
    const handoffResponse = JSON.parse(handoffResult.stdout.toString());
    expect(handoffResponse.status).toBe("handoff");
    expect(handoffResponse.command).toBe("handoff");

    // active.json must still exist so session save can read it
    const activePath = join(TEST_DIR, ".twisted/todo/my-feature/sessions/active.json");
    expect(existsSync(activePath)).toBe(true);

    const saveResult = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "session", "save", "-a"],
      { cwd: TEST_DIR, env, stdin: Buffer.from("## Session summary\n\nDid things.") },
    );
    const saveResponse = JSON.parse(saveResult.stdout.toString());
    expect(saveResponse.status).toBe("ok");
    expect(saveResponse.display).toContain("Session saved");

    // active.json must be deleted after save
    expect(existsSync(activePath)).toBe(false);

    // session file must exist
    const sessionsDir = join(TEST_DIR, ".twisted/todo/my-feature/sessions");
    const sessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith(".md"));
    expect(sessionFiles.length).toBe(1);
    expect(sessionFiles[0]).toContain("my-session");
  });

  it("tx session list shows saved sessions", async () => {
    const env = { ...process.env, TWISTED_ROOT: TEST_DIR };
    Bun.spawnSync(["bun", "run", CLI_PATH, "init", "-y", "-a"], { cwd: TEST_DIR, env });
    Bun.spawnSync(["bun", "run", CLI_PATH, "open", "my-feature", "-a"], { cwd: TEST_DIR, env });
    Bun.spawnSync(["bun", "run", CLI_PATH, "pickup", "first-session", "-a"], { cwd: TEST_DIR, env });
    Bun.spawnSync(["bun", "run", CLI_PATH, "session", "save", "-a"], {
      cwd: TEST_DIR, env, stdin: Buffer.from("Summary content"),
    });

    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "session", "list", "-a"],
      { cwd: TEST_DIR, env },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.display).toContain("first-session");
  });

  it("tx status shows objective", async () => {
    Bun.spawnSync(
      ["bun", "run", CLI_PATH, "init", "-y", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    Bun.spawnSync(
      ["bun", "run", CLI_PATH, "open", "my-feature", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );

    const result = Bun.spawnSync(
      ["bun", "run", CLI_PATH, "status", "-a"],
      { cwd: TEST_DIR, env: { ...process.env, TWISTED_ROOT: TEST_DIR } },
    );
    const response = JSON.parse(result.stdout.toString());
    expect(response.status).toBe("ok");
    expect(response.display).toContain("my-feature");
  });
});
