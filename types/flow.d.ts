/**
 * Flow configuration — auto-advance behavior and pause conditions.
 *
 * By default, twisted-workflow auto-advances between steps.
 * It pauses when model/effort/context settings change between steps
 * or when context is running low. All configurable.
 */

/** Flow configuration section. */
export interface FlowConfig {
  /**
   * Whether to auto-advance between pipeline steps.
   * When true, the pipeline continues without pausing (unless a pause
   * condition triggers). When false, pauses after every step.
   * Default: true.
   */
  auto_advance: boolean;

  /**
   * Pause when the next step has different model/effort/context settings.
   * Gives the user a chance to reconfigure their session.
   * Default: true.
   */
  pause_on_config_change: boolean;

  /**
   * Pause when context window utilization is high.
   * Suggests starting a new session to avoid degraded performance.
   * Default: true.
   */
  pause_on_low_context: boolean;
}

/**
 * Reasons the pipeline might pause during auto-advance.
 * Returned to the user when a pause occurs.
 */
export type PauseReason =
  | "config_change"
  | "low_context"
  | "user_requested"
  | "step_complete"
  | "error";
