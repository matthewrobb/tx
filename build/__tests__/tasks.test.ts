// build/__tests__/tasks.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { addTask, updateTask, assignTask, getTasks, getTasksByGroup } from "../../src/tasks/tasks.ts";
import type { Task } from "../../types/tasks";

describe("tasks", () => {
  let tasks: Task[];

  beforeEach(() => {
    tasks = [];
  });

  it("addTask creates with auto-incrementing id", () => {
    const task = addTask(tasks, { summary: "Add CLI entry point" });
    expect(task.id).toBe(1);
    expect(task.summary).toBe("Add CLI entry point");
    expect(task.done).toBe(false);
    expect(task.group).toBeNull();
  });

  it("updateTask marks done", () => {
    addTask(tasks, { summary: "task 1" });
    const updated = updateTask(tasks, 1, { done: true });
    expect(updated.done).toBe(true);
  });

  it("assignTask sets group", () => {
    addTask(tasks, { summary: "task 1" });
    const assigned = assignTask(tasks, 1, 2);
    expect(assigned.group).toBe(2);
  });

  it("getTasksByGroup filters correctly", () => {
    addTask(tasks, { summary: "a" });
    const t2 = addTask(tasks, { summary: "b" });
    assignTask(tasks, t2.id, 1);
    addTask(tasks, { summary: "c" });
    const t4 = addTask(tasks, { summary: "d" });
    assignTask(tasks, t4.id, 1);
    expect(getTasksByGroup(tasks, 1)).toHaveLength(2);
  });

  it("updateTask throws for unknown id", () => {
    expect(() => updateTask(tasks, 99, { done: true })).toThrow();
  });
});
