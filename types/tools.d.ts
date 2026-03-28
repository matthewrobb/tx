/**
 * Tool detection — tracks which external tools are installed.
 *
 * Scanned during `/twisted-work init` and `/twisted-work config tools`.
 * Informs preset suggestions and provider availability.
 */

/** Known tool names that twisted-workflow can detect and integrate with. */
export type ToolName = "gstack" | "superpowers" | "nimbalyst_skills";

/** Detection state for each known tool. */
export type DetectedTools = Record<ToolName, boolean>;

/** Tools configuration section. */
export interface ToolsConfig {
  /** Which tools were found during the last scan. */
  detected: DetectedTools;

  /** ISO-8601 timestamp of the last tool scan. Null if never scanned. */
  last_scan: string | null;
}
