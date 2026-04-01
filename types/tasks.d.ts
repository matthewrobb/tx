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

/** v4 Task — string id (T-001 format), optional story link and commit. */
export interface TaskV4 {
  id: string;
  summary: string;
  done: boolean;
  group: string | null;
  story_id?: string;
  commit?: string;
}

export interface TaskGroup {
  number: number;
  task_ids: number[];
  depends_on: number[];
  parallel_with: number[];
}
