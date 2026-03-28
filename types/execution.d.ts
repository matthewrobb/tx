/**
 * Execution configuration — how parallel work is coordinated.
 *
 * Controls the mechanism for spawning agents, worktree hierarchy,
 * merge strategy, review frequency, and test requirements.
 */

import type { ProviderString } from "./pipeline";

/**
 * Execution strategy for parallel issue work.
 *
 * - "task-tool"    — spawn subagents via Task/Agent tool (default, per-agent model flexibility)
 * - "agent-teams"  — spawn teammates via Agent Teams (visible to Nimbalyst, shared effort)
 * - "manual"       — print assignments + recommended configs for user to create sessions
 * - "auto"         — analyze issue characteristics and choose per group (future)
 */
export type ExecutionStrategy = "task-tool" | "agent-teams" | "manual" | "auto";

/**
 * Git merge strategy for agent worktrees back into the objective branch.
 *
 * - "normal"  — standard merge, preserves full commit history (default)
 * - "squash"  — squash merge, one commit per agent
 * - "rebase"  — rebase for linear history
 */
export type MergeStrategy = "normal" | "squash" | "rebase";

/**
 * When code review runs during execution.
 *
 * - "per-group"   — review after each group completes
 * - "risk-based"  — auto-review groups with high-complexity issues, skip trivial
 * - "after-all"   — one review after all groups complete (default)
 */
export type ReviewFrequency = "per-group" | "risk-based" | "after-all";

/**
 * Test pass requirement before an agent can report completion.
 *
 * - "must-pass"   — tests must pass, agent reports failure otherwise (default)
 * - "best-effort" — agent runs tests and reports results, but failure doesn't block
 * - "deferred"    — tests are not required during execution (early-stage projects)
 */
export type TestRequirement = "must-pass" | "best-effort" | "deferred";

/** Number of tiers in the worktree hierarchy. */
export type WorktreeTiers = 1 | 2 | 3;

/** Execution configuration section. */
export interface ExecutionConfig {
  /** How agents are spawned for parallel work. */
  strategy: ExecutionStrategy;

  /**
   * Build discipline provider invoked within each agent's execution.
   * Example: "superpowers:test-driven-development"
   * Null means no build discipline is enforced.
   */
  discipline: ProviderString | null;

  /**
   * Number of worktree tiers.
   * - 1: objective only (agents work on objective branch, no isolation)
   * - 2: objective → agent (default, one worktree per agent)
   * - 3: objective → group → agent (group-level worktree for structured merge)
   */
  worktree_tiers: WorktreeTiers;

  /** Whether independent groups can execute in parallel. */
  group_parallel: boolean;

  /** Git merge strategy for agent worktrees → objective branch. */
  merge_strategy: MergeStrategy;

  /** When code review runs during execution. */
  review_frequency: ReviewFrequency;

  /** Test pass requirement for agent completion. */
  test_requirement: TestRequirement;
}
