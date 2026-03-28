/**
 * Nimbalyst integration — plan and tracker output.
 *
 * When enabled, twisted-workflow writes Nimbalyst-compatible files
 * in `nimbalyst-local/` so Nimbalyst's Task Mode can discover them:
 *
 * - Plan file in `nimbalyst-local/plans/` with plan frontmatter
 * - Tracker items in `nimbalyst-local/tracker/tasks.md` using
 *   `#[type]` inline tags with ULID-based IDs
 *
 * Based on the Nimbalyst skills repos (Nimbalyst/skills,
 * Nimbalyst/developer-claude-code-commands) as of March 2026.
 */

// ---------------------------------------------------------------------------
// Plan frontmatter (nimbalyst-local/plans/)
// ---------------------------------------------------------------------------

/**
 * Nimbalyst plan frontmatter fields.
 * Written to `nimbalyst-local/plans/{objective}.md`.
 */
export interface NimbalystPlanFrontmatter {
  /** Unique plan identifier in kebab-case. Format: "plan-{objective}" */
  planId: string;

  /** Human-readable plan name. */
  title: string;

  /** Plan lifecycle status. */
  status: NimbalystStatus;

  /** Type of work. */
  planType: NimbalystPlanType;

  /** Priority level. */
  priority: NimbalystPriority;

  /** Primary assignee. */
  owner: string;

  /** Involved parties. */
  stakeholders: string[];

  /** Categorization labels. */
  tags: string[];

  /** ISO date (YYYY-MM-DD) when the plan was created. */
  created: string;

  /** ISO-8601 timestamp of last update. Never use midnight (00:00:00.000Z). */
  updated: string;

  /** Completion percentage (0-100). */
  progress: number;

  /** Optional start date (YYYY-MM-DD). */
  startDate?: string;

  /** Optional due date (YYYY-MM-DD). */
  dueDate?: string;
}

/** Plan status values recognized by Nimbalyst. */
export type NimbalystStatus =
  | "draft"
  | "ready-for-development"
  | "in-development"
  | "in-review"
  | "completed"
  | "rejected"
  | "blocked";

/** Plan type values recognized by Nimbalyst. */
export type NimbalystPlanType =
  | "feature"
  | "bug-fix"
  | "refactor"
  | "system-design"
  | "research";

/** Priority values recognized by Nimbalyst. */
export type NimbalystPriority = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// Tracker items (nimbalyst-local/tracker/)
// ---------------------------------------------------------------------------

/**
 * Tracker item inline tag format.
 *
 * Format: `- [description] #[type][id:[type]_[ulid] status:to-do priority:medium created:YYYY-MM-DD]`
 *
 * Items are appended to `nimbalyst-local/tracker/[type]s.md`.
 * Common types: task, bug, idea, decision, feature-request, tech-debt.
 */
export type NimbalystTrackerTag = string;

/** Tracker item status values. */
export type NimbalystTrackerStatus =
  | "to-do"
  | "in-progress"
  | "done"
  | "blocked";

/** Tracker item types that map to separate files. */
export type NimbalystTrackerType =
  | "task"
  | "bug"
  | "idea"
  | "decision"
  | "feature-request"
  | "tech-debt";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Nimbalyst integration configuration. */
export interface NimbalystConfig {
  /**
   * Write Nimbalyst-compatible plan and tracker files.
   * Auto-enabled by the nimbalyst preset.
   * Default: false.
   */
  enabled: boolean;

  /**
   * Default priority for new objectives.
   * Default: "medium".
   */
  default_priority: NimbalystPriority;

  /**
   * Default owner for tracked items.
   * Default: "claude".
   */
  default_owner: string;
}
