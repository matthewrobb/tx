/**
 * State configuration and objective state machine.
 *
 * Frontmatter in state.md is the source of truth. Folder-based kanban
 * mirrors frontmatter by default and can be disabled.
 */

import type { ProviderString, PipelinePhase } from "./pipeline";

/**
 * Objective status — maps to kanban columns.
 * Frontmatter `status` is the source of truth.
 * When folders are enabled, folder location mirrors this value.
 */
export type ObjectiveStatus =
  | "todo"
  | "in-progress"
  | "done"
  | "blocked";

/**
 * Pipeline steps in execution order.
 * Includes both core and delegatable phases.
 */
export type ObjectiveStep =
  | "research"
  | "scope"
  | "arch_review"
  | "decompose"
  | "execute"
  | "code_review"
  | "qa"
  | "ship";

/**
 * Valid step transitions. A step can advance to the next step in order,
 * or skip delegatable steps that are configured as "skip".
 */
export interface StepTransition {
  from: ObjectiveStep;
  to: ObjectiveStep;
  /** Whether this transition skips an intermediate delegatable phase. */
  skipped?: ObjectiveStep[];
}

/**
 * The complete ordered step sequence.
 * Delegatable steps configured as "skip" are omitted at runtime.
 */
export type StepSequence = readonly ObjectiveStep[];

/** Providers that were actually used for each step (recorded after execution). */
export type ToolsUsed = Partial<Record<ObjectiveStep, ProviderString>>;

/**
 * Objective state — stored in state.md frontmatter.
 * This is the session-independent state that allows any session
 * to resume an objective at the exact step.
 */
export interface ObjectiveState {
  /** Objective identifier (also the folder/branch name). */
  objective: string;

  /** Current kanban status. Source of truth for folder location. */
  status: ObjectiveStatus;

  /** Current pipeline step. */
  step: ObjectiveStep;

  /** Steps that have been completed. */
  steps_completed: ObjectiveStep[];

  /** Steps remaining (excluding current). */
  steps_remaining: ObjectiveStep[];

  /** Current execution group number (1-indexed). Null if not in execute step. */
  group_current: number | null;

  /** Total number of execution groups. Null if not yet decomposed. */
  groups_total: number | null;

  /** Number of issues marked done. */
  issues_done: number;

  /** Total number of issues. Null if not yet decomposed. */
  issues_total: number | null;

  /** ISO-8601 date when the objective was created. */
  created: string;

  /** ISO-8601 timestamp of the last state update. */
  updated: string;

  /** Which providers were used for each completed step. */
  tools_used: ToolsUsed;
}

/** Folder-based kanban lane paths. */
export interface FolderKanbanConfig {
  /** Path for todo/backlog objectives. Default: ".twisted/todo" */
  todo: string;

  /** Path for in-progress objectives. Default: ".twisted/in-progress" */
  in_progress: string;

  /** Path for completed objectives. Default: ".twisted/done" */
  done: string;
}

/** State management configuration section. */
export interface StateConfig {
  /**
   * Whether to use folder-based kanban lanes.
   * When true, objectives are moved between folders as status changes.
   * When false, all objectives live in flat `.twisted/{name}/` directories.
   * Default: true.
   */
  use_folders: boolean;

  /** Folder paths for kanban lanes (only used when `use_folders` is true). */
  folder_kanban: FolderKanbanConfig;
}
