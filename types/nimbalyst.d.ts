/**
 * Nimbalyst integration — companion tracker output.
 *
 * When enabled, twisted-workflow writes Nimbalyst-compatible markdown
 * files alongside its own state files. These use @task/@bug inline tags
 * and plan-style frontmatter that Nimbalyst's Task Mode can discover.
 *
 * EXPERIMENTAL: Nimbalyst's tracker format is not fully publicly documented.
 * This integration is best-effort based on observed behavior as of v0.56.
 * Field names and tag syntax may need adjustment as Nimbalyst evolves.
 */

/**
 * Nimbalyst frontmatter fields for plan/task documents.
 * These are the fields Nimbalyst's Task Mode reads from YAML frontmatter.
 */
export interface NimbalystFrontmatter {
  status: NimbalystStatus;
  priority: NimbalystPriority;
  progress: number;
  owner: string;
  stakeholders?: string[];
  dueDate?: string;
}

/** Status values recognized by Nimbalyst's kanban. */
export type NimbalystStatus =
  | "draft"
  | "ready-for-development"
  | "in-development"
  | "in-review"
  | "completed"
  | "blocked";

/** Priority values recognized by Nimbalyst. */
export type NimbalystPriority = "low" | "medium" | "high" | "critical";

/** Inline tag types recognized by Nimbalyst's tracker. */
export type NimbalystTag = "@task" | "@bug" | "@idea" | "@decision";

/** Nimbalyst integration configuration. */
export interface NimbalystConfig {
  /**
   * Write Nimbalyst-compatible tracker files alongside objective state.
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
