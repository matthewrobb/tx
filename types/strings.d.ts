/**
 * String templates — configurable text patterns used in skill output.
 *
 * Any user-facing text that contains placeholders or follows a pattern
 * should be typed here. Skills reference these types rather than
 * hardcoding strings.
 */

// ---------------------------------------------------------------------------
// Commit messages
// ---------------------------------------------------------------------------

/** Commit message templates with placeholder substitution. */
export interface CommitMessageTemplates {
  /** Initial setup commit. Default: "chore: add twisted workflow" */
  init: string;

  /**
   * Commit after scope/decompose completes.
   * Placeholder: {objective}
   * Default: "chore: add {objective} research and plan"
   */
  plan: string;

  /**
   * Commit when an objective is completed.
   * Placeholder: {objective}
   * Default: "chore: complete {objective}"
   */
  done: string;

  /**
   * Commit when moving objective between kanban lanes.
   * Placeholders: {objective}, {from}, {to}
   * Default: "chore: move {objective} from {from} to {to}"
   */
  lane_move: string;

  /**
   * Commit for group merge into objective branch.
   * Placeholders: {objective}, {group}
   * Default: "feat({objective}): complete group {group}"
   */
  group_merge: string;
}

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

/**
 * Status display format for `/twisted-work status`.
 * Placeholders: {objective}, {status}, {step}, {progress}, {updated}
 */
export type StatusLineTemplate = string;

/**
 * Detailed status display for `/twisted-work status {objective}`.
 * Placeholders: {objective}, {status}, {step}, {steps_completed},
 *   {steps_remaining}, {group_current}, {groups_total},
 *   {issues_done}, {issues_total}, {created}, {updated}
 */
export type StatusDetailTemplate = string;

// ---------------------------------------------------------------------------
// Phase recommendations
// ---------------------------------------------------------------------------

/**
 * Phase setting recommendation display.
 * Shown when auto-advance pauses due to config change.
 * Placeholders: {step}, {model}, {effort}, {context}, {mode}
 */
export type PhaseRecommendationTemplate = string;

// ---------------------------------------------------------------------------
// Research sections
// ---------------------------------------------------------------------------

/**
 * Research section heading in RESEARCH-*.md files.
 * Placeholders: {n} (agent number), {focus} (assigned focus area)
 * Default: "## Agent {n} — {focus}"
 */
export type ResearchSectionTemplate = string;

// ---------------------------------------------------------------------------
// Handoff messages
// ---------------------------------------------------------------------------

/** Messages shown at step boundaries. */
export interface HandoffMessageTemplates {
  /**
   * After research completes, before scope.
   * Placeholder: {research_count}
   * Default: "Research complete ({research_count} agents). Starting scope."
   */
  research_to_scope: string;

  /**
   * After scope completes, before decompose.
   * Placeholder: {category_count}
   * Default: "Requirements captured across {category_count} categories. Starting decomposition."
   */
  scope_to_decompose: string;

  /**
   * After decompose completes, before execute.
   * Placeholders: {issue_count}, {group_count}, {agent_count}
   * Default: "{issue_count} issues in {group_count} groups ({agent_count} agents). Ready to execute."
   */
  decompose_to_execute: string;

  /**
   * After execute completes, before review.
   * Placeholders: {issues_done}, {issues_total}
   * Default: "Execution complete ({issues_done}/{issues_total} issues). Starting review."
   */
  execute_to_review: string;

  /**
   * After review completes, before ship.
   * Default: "Review passed. Ready to ship."
   */
  review_to_ship: string;

  /**
   * After ship completes (objective done).
   * Placeholder: {objective}
   * Default: "Objective {objective} complete."
   */
  ship_done: string;
}

// ---------------------------------------------------------------------------
// Agent prompts
// ---------------------------------------------------------------------------

/**
 * Prompt template for spawning a research subagent.
 * Placeholders: {objective}, {focus}, {codebase_context}
 */
export type ResearchAgentPromptTemplate = string;

/**
 * Prompt template for spawning an execution subagent.
 * Placeholders: {objective}, {issue_ids}, {issue_details},
 *   {worktree_path}, {branch_name}, {test_requirement}, {discipline}
 */
export type ExecutionAgentPromptTemplate = string;

// ---------------------------------------------------------------------------
// Interrogation
// ---------------------------------------------------------------------------

/**
 * Interrogation prompt template for each category.
 * Placeholder: {category}
 * Default: "Let's drill into {category}. Tell me everything about..."
 */
export type InterrogationPromptTemplate = string;

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

/**
 * Changelog entry template lines.
 * Placeholders: {date}, {objective}, {completed}, {deferred}, {decisions}
 */
export type ChangelogEntryTemplate = string[];

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/** All string templates used across skills. */
export interface StringTemplates {
  commit_messages: CommitMessageTemplates;
  status_line: StatusLineTemplate;
  status_detail: StatusDetailTemplate;
  phase_recommendation: PhaseRecommendationTemplate;
  research_section: ResearchSectionTemplate;
  handoff_messages: HandoffMessageTemplates;
  research_agent_prompt: ResearchAgentPromptTemplate;
  execution_agent_prompt: ExecutionAgentPromptTemplate;
  interrogation_prompt: InterrogationPromptTemplate;
  changelog_entry: ChangelogEntryTemplate;
}
