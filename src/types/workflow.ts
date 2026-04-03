// src/types/workflow.ts — Workflow and step definition types for v4.
//
// A Workflow is an ordered DAG of steps. Each step declares its dependencies
// (needs), conditions (skip/done/block), and artifacts (produces/requires).
// The engine evaluates these at runtime — no hardcoded step sequences.

import type { IssueType } from './issue.js';

/** Branded string for workflow identifiers. */
export type WorkflowId = string & { readonly _brand: 'WorkflowId' };

/**
 * An artifact that a step produces or requires.
 *
 * The engine checks artifact existence (and optionally content) to determine
 * step readiness and completion.
 */
export interface StepArtifact {
  /** Path relative to the issue's data directory. */
  path: string;

  /**
   * Optional content validator name (e.g. "non-empty", "valid-json").
   * When present, the engine calls the named predicate against file content
   * in addition to checking existence.
   */
  predicate?: string;
}

/**
 * A single step within a workflow.
 *
 * Steps form a DAG via `needs`. The engine evaluates conditions as expression
 * strings (parsed and evaluated by the expression engine, see expressions.ts).
 */
export interface StepDef {
  /** Unique within the workflow (e.g. "research", "build"). */
  id: string;

  /** Human-readable title for display. */
  title: string;

  /**
   * Step IDs this step depends on (DAG edges).
   * A step cannot start until all its dependencies are complete or skipped.
   */
  needs: string[];

  /**
   * Expression string — if it evaluates to true, the step is auto-skipped.
   * Example: "issue.type == 'chore'" to skip research for chores.
   */
  skip_when?: string;

  /**
   * Expression string — if it evaluates to true, the step is considered done.
   * Example: "artifacts.all_present" to complete when all produced files exist.
   */
  done_when?: string;

  /**
   * Expression string — if it evaluates to true, the step is blocked.
   * Example: "issue.status == 'blocked'" for external dependency gates.
   */
  block_when?: string;

  /** Artifacts this step writes on completion. */
  produces?: StepArtifact[];

  /** Artifacts required before this step can start. */
  requires?: StepArtifact[];

  /**
   * Agent prompt template — injected when an agent runs this step.
   * May contain template variables like {{issue.title}}.
   */
  prompt?: string;
}

export interface Workflow {
  readonly id: WorkflowId;
  slug: string;
  title: string;

  /**
   * Ordered list of step definitions.
   *
   * While step ordering is primarily determined by the `needs` DAG, the
   * array order serves as a tiebreaker for steps with identical dependency
   * depth (i.e., it defines a preferred execution order among siblings).
   */
  steps: StepDef[];

  /**
   * When set, this workflow is automatically assigned to issues of these types.
   * Only one workflow should be default for each IssueType.
   */
  default_for?: IssueType[];
}
