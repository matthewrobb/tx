/**
 * Writing configuration — quality skill for human-facing text.
 *
 * Applies to commit messages, changelog entries, status displays,
 * handoff messages, summaries, and objective name suggestions.
 */

/** Writing configuration section. */
export interface WritingConfig {
  /**
   * Name of the writing quality skill to invoke.
   * Default: "writing-clearly-and-concisely".
   * Set to null to disable writing skill invocation.
   */
  skill: string | null;

  /**
   * Whether to use built-in writing rules when the configured skill
   * is unavailable. Built-in rules: active voice, one idea per sentence,
   * no filler, imperative commit messages, facts-only status.
   * Default: true.
   */
  fallback: boolean;
}
