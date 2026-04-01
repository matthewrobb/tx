/**
 * State types for twisted-workflow v4.
 */

/** Epic status in the lane model. */
export type EpicStatus = "active" | "blocked" | "done";

/**
 * v4 CoreState — stored in state.json under the epic's lane directory.
 * Drives the artifact-based engine.
 */
export interface CoreState {
  /** Epic identifier (also the directory name). */
  epic: string;

  /** Epic type determines lane sequence. */
  type: import("./epic").EpicType;

  /** Current lane directory name (e.g. "2-active"). */
  lane: string;

  /** Current step name within the lane. */
  step: string;

  /** Lifecycle status. */
  status: EpicStatus;

  /** Number of tasks marked done. */
  tasks_done: number;

  /** Total number of tasks. Null if not yet planned. */
  tasks_total: number | null;

  /** ISO-8601 date when the epic was created. */
  created: string;

  /** ISO-8601 timestamp of the last state update. */
  updated: string;
}
