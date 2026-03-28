/**
 * Issue model — the work breakdown produced by the decompose step.
 *
 * Issues are organized into dependency-ordered groups. Complexity
 * estimation drives agent assignment (batch, standard, or split).
 */

/**
 * Agent assignment strategy for an issue, derived from complexity.
 *
 * - "batch"    — grouped with other trivial issues into one agent
 * - "standard" — one agent per issue (default for mid-complexity)
 * - "split"    — auto-decomposed into sub-issues, multiple agents
 */
export type AgentAssignment = "batch" | "standard" | "split";

/** A complexity estimate for a single issue. */
export interface ComplexityEstimate {
  /** Numeric value on the configured estimation scale. */
  value: number;

  /** Human-readable label (e.g., "3" for fibonacci, "M" for t-shirt). */
  label: string;

  /** Derived agent assignment strategy based on thresholds. */
  assignment: AgentAssignment;
}

/** A single issue in the work breakdown. */
export interface Issue {
  /** Unique identifier (e.g., "ISSUE-001"). */
  id: string;

  /** Short descriptive title. */
  title: string;

  /** Issue type. */
  type: "bug" | "refactor" | "feature" | "test" | (string & {});

  /** Area of the codebase affected. */
  area: string;

  /** Primary file(s) to be modified. */
  file: string;

  /** Description of the current state. */
  current_state: string;

  /** Description of the target state. */
  target_state: string;

  /** IDs of issues this issue depends on (must complete first). */
  dependencies: string[];

  /** Execution group number (1-indexed). */
  group: number;

  /** Complexity estimate. */
  complexity: ComplexityEstimate;

  /** Whether the issue is complete. */
  done: boolean;

  /**
   * Sub-issues created when a large issue is auto-split.
   * Only present when `complexity.assignment` is "split".
   */
  sub_issues?: Issue[];

  /** Additional user-defined fields from the configurable template. */
  [key: string]: unknown;
}

/** A group of issues that can execute in parallel. */
export interface IssueGroup {
  /** Group number (1-indexed). */
  number: number;

  /** Issues in this group (no intra-group dependencies). */
  issues: Issue[];

  /**
   * Group numbers this group depends on.
   * All dependent groups must complete before this group starts.
   */
  depends_on: number[];

  /**
   * Groups that are independent of this group (can run in parallel).
   * Computed from the dependency graph.
   */
  parallel_with: number[];
}

/** Dependency graph for all groups. */
export interface DependencyGraph {
  /** All groups in dependency order. */
  groups: IssueGroup[];

  /** Total issue count (including sub-issues from splits). */
  total_issues: number;

  /** Number of batched agent slots (trivial issues grouped). */
  batched_agents: number;

  /** Number of standard agent slots (1:1 issue:agent). */
  standard_agents: number;

  /** Number of split agent slots (sub-issues from large issues). */
  split_agents: number;

  /** Total agents needed to execute all groups. */
  total_agents: number;
}
