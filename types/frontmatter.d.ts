/**
 * Frontmatter schemas for all markdown artifact files.
 *
 * Each artifact file (state.md, ISSUES.md, REQUIREMENTS.md, PLAN.md)
 * has typed YAML frontmatter. These types define the expected shape.
 */

import type { ObjectiveState } from "./state";
import type { Issue, IssueGroup } from "./issues";

/**
 * Frontmatter for state.md — the objective's primary state file.
 * This is the same as ObjectiveState (re-exported for clarity).
 */
export type ObjectiveFrontmatter = ObjectiveState;

/** Frontmatter for REQUIREMENTS.md. */
export interface RequirementsFrontmatter {
  /** Objective this requirements doc belongs to. */
  objective: string;

  /** ISO-8601 date the requirements were captured. */
  created: string;

  /** ISO-8601 timestamp of the last update. */
  updated: string;

  /**
   * Categories that have been interrogated.
   * Matches the configured interrogation categories.
   */
  categories_completed: string[];

  /** Categories remaining. */
  categories_remaining: string[];

  /** Whether the requirements are considered complete. */
  complete: boolean;
}

/** Frontmatter for ISSUES.md. */
export interface IssuesFrontmatter {
  /** Objective this issue breakdown belongs to. */
  objective: string;

  /** ISO-8601 date the breakdown was created. */
  created: string;

  /** ISO-8601 timestamp of the last update. */
  updated: string;

  /** Total number of issues. */
  total_issues: number;

  /** Number of issues marked done. */
  issues_done: number;

  /** Number of execution groups. */
  total_groups: number;

  /** Estimation scale used. */
  estimation_scale: string;
}

/** Frontmatter for PLAN.md. */
export interface PlanFrontmatter {
  /** Objective this plan belongs to. */
  objective: string;

  /** ISO-8601 date the plan was created. */
  created: string;

  /** ISO-8601 timestamp of the last update. */
  updated: string;

  /** Number of execution groups in the plan. */
  total_groups: number;

  /** Total agents needed across all groups. */
  total_agents: number;

  /** Execution order summary (group numbers in order). */
  execution_order: number[][];
}

/** Frontmatter for RESEARCH-*.md files. */
export interface ResearchFrontmatter {
  /** Objective this research belongs to. */
  objective: string;

  /** Research agent number (for multi-agent research). */
  agent_number: number;

  /** Focus area assigned to this research agent. */
  focus: string;

  /** ISO-8601 date the research was completed. */
  created: string;

  /** Status of this research agent's work. */
  status: "done" | "failed" | "partial";
}
