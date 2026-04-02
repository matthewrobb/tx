// build/__tests__/estimation.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const TEST_DIR = join(import.meta.dirname, "../.test-output/estimation");
const PROJECT_ROOT = join(import.meta.dirname, "../..");
const CLI_PATH = join(PROJECT_ROOT, "src/cli/index.ts");
const NODE = process.execPath;
const TSX_LOADER = ["--import", "tsx"];

function run(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  return spawnSync(NODE, [...TSX_LOADER, CLI_PATH, ...args, "-a"], {
    cwd: opts.cwd ?? TEST_DIR,
    env: { ...process.env, TWISTED_ROOT: TEST_DIR, ...(opts.env ?? {}) },
  });
}

function parseOut(result: ReturnType<typeof spawnSync>) {
  return JSON.parse(result.stdout.toString());
}

describe("tx estimate", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    run(["init", "-y"]);
    run(["open", "my-epic", "--description", "Test epic"]);
  });

  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it("writes estimate.json with defaults", () => {
    const result = run(["estimate", "my-epic", "--size", "M", "--rationale", "medium effort"]);
    const response = parseOut(result);
    expect(response.status).toBe("ok");
    expect(response.command).toBe("estimate");

    // Find estimate.json in any lane
    const todoPath = join(TEST_DIR, ".twisted/0-backlog/my-epic/estimate.json");
    expect(existsSync(todoPath)).toBe(true);
    const estimate = JSON.parse(readFileSync(todoPath, "utf-8"));
    expect(estimate.size).toBe("M");
    expect(estimate.rationale).toBe("medium effort");
    expect(estimate.confidence).toBe(3);
  });

  it("writes timebox for spike type", () => {
    run(["estimate", "my-epic", "--size", "S", "--rationale", "time-boxed spike", "--timebox", "P2D"]);
    const todoPath = join(TEST_DIR, ".twisted/0-backlog/my-epic/estimate.json");
    const estimate = JSON.parse(readFileSync(todoPath, "utf-8"));
    expect(estimate.timebox).toBe("P2D");
  });

  it("returns error when epic not found", () => {
    const result = run(["estimate", "nonexistent", "--size", "S", "--rationale", "test"]);
    const response = parseOut(result);
    expect(response.status).toBe("error");
  });

  it("stores confidence level", () => {
    run(["estimate", "my-epic", "--size", "L", "--rationale", "large", "--confidence", "5"]);
    const todoPath = join(TEST_DIR, ".twisted/0-backlog/my-epic/estimate.json");
    const estimate = JSON.parse(readFileSync(todoPath, "utf-8"));
    expect(estimate.confidence).toBe(5);
  });
});
