// types/epic.d.ts

/** Epic types determine which lane sequence an epic follows. */
export type EpicType = "feature" | "bug" | "spike" | "chore" | "release";

/**
 * Per-type lane sequence config.
 * Determines which lanes an epic of this type passes through.
 */
export interface TypeConfig {
  type: EpicType;
  /** Ordered lane dir names this type traverses (e.g. ["0-backlog", "1-ready", "2-active", "4-done"]). */
  lanes: string[];
}
