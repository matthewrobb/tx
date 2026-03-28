import { describe, test, expect } from "bun:test";
import { getWorktreePaths, getWorktreeCommands } from "../../src/strategies/worktree.js";

describe("getWorktreePaths", () => {
  const dir = ".twisted/worktrees";
  const obj = "auth-refactor";

  test("1 tier — objective only", () => {
    const paths = getWorktreePaths(dir, obj, 1);
    expect(paths.objective).toBe(".twisted/worktrees/auth-refactor");
    expect(paths.group).toBeNull();
    expect(paths.agent).toBeNull();
  });

  test("2 tiers — objective + agents", () => {
    const paths = getWorktreePaths(dir, obj, 2);
    expect(paths.objective).toBe(".twisted/worktrees/auth-refactor");
    expect(paths.group).toBeNull();
    expect(paths.agent).not.toBeNull();
    expect(paths.agent!(1, 1)).toBe(".twisted/worktrees/auth-refactor-agent-1");
    expect(paths.agent!(1, 3)).toBe(".twisted/worktrees/auth-refactor-agent-3");
  });

  test("3 tiers — objective + groups + agents", () => {
    const paths = getWorktreePaths(dir, obj, 3);
    expect(paths.objective).toBe(".twisted/worktrees/auth-refactor");
    expect(paths.group).not.toBeNull();
    expect(paths.group!(1)).toBe(".twisted/worktrees/auth-refactor-group-1");
    expect(paths.group!(2)).toBe(".twisted/worktrees/auth-refactor-group-2");
    expect(paths.agent).not.toBeNull();
    expect(paths.agent!(1, 1)).toBe(".twisted/worktrees/auth-refactor-group-1-agent-1");
    expect(paths.agent!(2, 3)).toBe(".twisted/worktrees/auth-refactor-group-2-agent-3");
  });
});

describe("getWorktreeCommands", () => {
  const dir = ".twisted/worktrees";
  const obj = "auth-refactor";

  test("1 tier — just objective worktree", () => {
    const cmds = getWorktreeCommands(dir, obj, 1, 1, 3);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toContain("git worktree add");
    expect(cmds[0]).toContain("-b auth-refactor");
  });

  test("2 tiers — objective + agent worktrees", () => {
    const cmds = getWorktreeCommands(dir, obj, 2, 1, 2);
    expect(cmds).toHaveLength(3); // 1 objective + 2 agents
    expect(cmds[1]).toContain("agent-1");
    expect(cmds[1]).toContain(`-b ${obj}/agent-1`);
    expect(cmds[2]).toContain("agent-2");
  });

  test("3 tiers — objective + group + agent worktrees", () => {
    const cmds = getWorktreeCommands(dir, obj, 3, 2, 2);
    expect(cmds).toHaveLength(4); // 1 objective + 1 group + 2 agents
    expect(cmds[1]).toContain("group-2");
    expect(cmds[1]).toContain(`-b ${obj}/group-2`);
    expect(cmds[2]).toContain("group-2-agent-1");
    expect(cmds[3]).toContain("group-2-agent-2");
  });
});
