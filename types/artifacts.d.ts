/**
 * Artifact file schemas — the structured files produced by each step.
 *
 * Each artifact has typed frontmatter and a defined content structure.
 * These types describe what each file must contain.
 */

import type {
  ObjectiveFrontmatter,
  RequirementsFrontmatter,
  IssuesFrontmatter,
  PlanFrontmatter,
  ResearchFrontmatter,
} from "./frontmatter";
import type { Issue, IssueGroup, DependencyGraph } from "./issues";

/** A research artifact produced by a single research agent. */
export interface ResearchFile {
  frontmatter: ResearchFrontmatter;

  /** Structured findings from the research agent. */
  content: {
    findings: string;
    key_files: string[];
    patterns_found: string[];
    concerns: string[];
  };
}

/** The requirements artifact produced by the scope step. */
export interface RequirementsFile {
  frontmatter: RequirementsFrontmatter;

  /**
   * Requirements organized by interrogation category.
   * Each category contains the faithful record of what the human stated.
   */
  content: {
    categories: Record<string, string[]>;
  };
}

/** The issues artifact produced by the decompose step. */
export interface IssuesFile {
  frontmatter: IssuesFrontmatter;

  content: {
    issues: Issue[];
    groups: IssueGroup[];
  };
}

/** The execution plan artifact produced by the decompose step. */
export interface PlanFile {
  frontmatter: PlanFrontmatter;

  content: {
    /** Dependency graph with group ordering and agent assignments. */
    dependency_graph: DependencyGraph;

    /** Execution order: array of arrays of group numbers that can run concurrently. */
    execution_order: number[][];

    /** Notes about the execution strategy. */
    notes: string;
  };
}

/** Execution log entry for a completed agent. */
export interface AgentLogEntry {
  /** Issue ID(s) this agent worked on. */
  issue_ids: string[];

  /** Agent assignment type. */
  assignment: "batch" | "standard" | "split";

  /** Group number. */
  group: number;

  /** Whether the agent completed successfully. */
  success: boolean;

  /** Summary of what the agent did. */
  summary: string;

  /** ISO-8601 timestamp of completion. */
  completed_at: string;

  /** Test results if tests were run. */
  test_results?: {
    passed: number;
    failed: number;
    skipped: number;
  };
}

/** The execution log tracking agent progress and results. */
export interface ExecutionLog {
  /** Objective this log belongs to. */
  objective: string;

  /** Completed agent entries. */
  agents: AgentLogEntry[];

  /** Groups that have been fully merged. */
  groups_merged: number[];

  /** Review results if reviews were run. */
  reviews: Array<{
    provider: string;
    group: number | "all";
    passed: boolean;
    findings: string;
    timestamp: string;
  }>;
}

/**
 * All artifact files for an objective.
 * Represents the complete set of files in `.twisted/{objective}/`.
 */
export interface ObjectiveArtifacts {
  state: ObjectiveFrontmatter;
  research: ResearchFile[];
  requirements: RequirementsFile | null;
  issues: IssuesFile | null;
  plan: PlanFile | null;
  execution_log: ExecutionLog | null;
}
