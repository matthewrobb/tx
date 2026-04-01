// build/__tests__/cli-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
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
