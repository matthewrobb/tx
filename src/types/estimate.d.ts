// types/estimate.d.ts

/**
 * Estimation record stored in estimate.json under the epic's 1-ready lane directory.
 * Produced by the estimate step; required before entering 2-active.
 */
export interface EstimateFile {
  /** Epic name. */
  epic: string;

  /** T-shirt size estimate (XS/S/M/L/XL). */
  size: "XS" | "S" | "M" | "L" | "XL";

  /** Confidence level (1–5). */
  confidence: 1 | 2 | 3 | 4 | 5;

  /** Short rationale for the estimate. */
  rationale: string;

  /**
   * For spikes only: maximum time budget before promotion or abandonment.
   * ISO-8601 duration string (e.g. "P2D" = 2 days).
   */
  timebox?: string;

  /** ISO-8601 timestamp when the estimate was created. */
  created: string;

  /** ISO-8601 timestamp of the last update. */
  updated: string;
}
