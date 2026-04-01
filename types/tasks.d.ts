// types/tasks.d.ts

export type TaskType = "bug" | "refactor" | "feature" | "test";

export type AgentAssignment = "batch" | "standard" | "split";

export interface Task {
  id: number;
  summary: string;
  type: TaskType;
  area: string;
  file: string;
  current_state: string;
  target_state: string;
  dependencies: number[];
  group: number | null;
  complexity: number;
  done: boolean;
}

export interface TaskGroup {
  number: number;
  task_ids: number[];
  depends_on: number[];
  parallel_with: number[];
}
