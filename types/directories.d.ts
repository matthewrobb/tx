/**
 * Directory and file path configuration.
 */

/** Directory paths used by twisted-workflow. */
export interface DirectoryConfig {
  /** Root directory for all twisted-workflow state. Default: ".twisted" */
  root: string;

  /** Directory for git worktrees (gitignored). Default: ".twisted/worktrees" */
  worktrees: string;
}

/** File path configuration. */
export interface FilePathConfig {
  /** Path to the project settings file. Default: ".twisted/settings.json" */
  settings: string;

  /** Path to the project changelog. Default: "CHANGELOG.md" */
  changelog: string;

  /**
   * Sort order for changelog entries.
   * Default: "newest-first" (prepend new entries).
   */
  changelog_sort: "newest-first" | "oldest-first";
}

/** Naming configuration for objectives. */
export interface NamingConfig {
  /**
   * Naming strategy for auto-generated objective names.
   * - "prefix": zero-padded numeric prefix (e.g., "001", "002")
   */
  strategy: "prefix";

  /** Zero-padding width for numeric names. Default: 3. */
  increment_padding: number;
}
