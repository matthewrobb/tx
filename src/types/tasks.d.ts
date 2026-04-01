// types/tasks.d.ts

export type TaskType = "bug" | "refactor" | "feature" | "test";

/** Task — string id (T-001 format), optional story link and commit. */
export interface Task {
  id: string;
  summary: string;
  done: boolean;
  group: string | null;
  story_id?: string;
  commit?: string;
}
