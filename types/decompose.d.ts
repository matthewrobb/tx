/**
 * Decompose configuration — controls how objectives are broken into issues.
 *
 * Includes complexity estimation scales, agent assignment thresholds,
 * and configurable interrogation categories for the scope step.
 */

/**
 * Estimation scale for issue complexity.
 *
 * - "fibonacci"  — 1, 2, 3, 5, 8, 13, 21 (default)
 * - "linear"     — 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
 * - "tshirt"     — XS=1, S=2, M=3, L=5, XL=8, XXL=13
 * - "custom"     — user-defined scale in `custom_scale`
 */
export type EstimationScale = "fibonacci" | "linear" | "tshirt" | "custom";

/** Fibonacci scale values. */
export type FibonacciValue = 1 | 2 | 3 | 5 | 8 | 13 | 21;

/** T-shirt size labels mapped to numeric values. */
export type TShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

/** Complexity thresholds that drive agent assignment strategy. */
export interface ComplexityThresholds {
  /**
   * Issues with complexity at or below this value are batched
   * together into a single agent. Default: 2.
   */
  batch_threshold: number;

  /**
   * Issues with complexity at or above this value are auto-split
   * into sub-issues, each getting its own agent. Default: 8.
   */
  split_threshold: number;
}

/**
 * Default interrogation categories for the scope step.
 * Configurable — users can add, remove, or reorder categories.
 */
export type InterrogationCategory = string;

/** Default categories shipped with twisted-workflow. */
export type DefaultCategory = "scope" | "behavior" | "constraints" | "acceptance";

/** Decompose configuration section. */
export interface DecomposeConfig {
  /** Which estimation scale to use for complexity scoring. */
  estimation: EstimationScale;

  /** Issues at or below this complexity get batched into one agent. */
  batch_threshold: number;

  /** Issues at or above this complexity get auto-split into sub-issues. */
  split_threshold: number;

  /**
   * Custom scale values when `estimation` is "custom".
   * Array of ascending numeric values.
   */
  custom_scale?: number[];

  /**
   * Interrogation categories for the scope step.
   * Drilled one at a time until requirements are concrete and testable.
   */
  categories: InterrogationCategory[];
}
