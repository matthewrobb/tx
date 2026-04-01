// src/tasks/tasks.ts
import type { Task, TaskType } from "../../types/tasks.js";

interface AddTaskInput {
  summary: string;
  type?: TaskType;
  area?: string;
  file?: string;
  current_state?: string;
  target_state?: string;
  dependencies?: number[];
  group?: number | null;
  complexity?: number;
}

interface UpdateTaskInput {
  done?: boolean;
  group?: number;
  summary?: string;
  type?: TaskType;
  complexity?: number;
}

export function addTask(tasks: Task[], input: AddTaskInput): Task {
  const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
  const task: Task = {
    id: maxId + 1,
    summary: input.summary,
    type: input.type ?? "feature",
    area: input.area ?? "",
    file: input.file ?? "",
    current_state: input.current_state ?? "",
    target_state: input.target_state ?? "",
    dependencies: input.dependencies ?? [],
    group: input.group ?? null,
    complexity: input.complexity ?? 1,
    done: false,
  };
  tasks.push(task);
  return task;
}

export function updateTask(tasks: Task[], id: number, updates: UpdateTaskInput): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} not found`);
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) (task as unknown as Record<string, unknown>)[key] = value;
  }
  return task;
}

export function assignTask(tasks: Task[], id: number, group: number): Task {
  return updateTask(tasks, id, { group });
}

export function getTasks(tasks: Task[]): Task[] {
  return tasks;
}

export function getTasksByGroup(tasks: Task[], group: number): Task[] {
  return tasks.filter((t) => t.group === group);
}

export function getTask(tasks: Task[], id: number): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task ${id} not found`);
  return task;
}
