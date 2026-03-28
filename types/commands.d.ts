/**
 * Command interface — subcommands, params, and flags for /twisted-work.
 *
 * /twisted-work is the single user-facing skill. All interaction
 * is through subcommands and flags.
 */

/** Top-level subcommands for /twisted-work. */
export type TwistedSubcommand =
  | "init"
  | "status"
  | "next"
  | "resume"
  | "scope"
  | "decompose"
  | "execute"
  | "review"
  | "ship"
  | "config";

/** Config drill-down paths for /twisted-work config. */
export type ConfigSection =
  | "tools"
  | "pipeline"
  | "execution"
  | "phases"
  | "decompose"
  | "templates"
  | "writing"
  | "state"
  | "flow";

/** Deeper drill-down within pipeline config. */
export type PipelineSection =
  | "research"
  | "arch_review"
  | "code_review"
  | "qa"
  | "ship";

/** Global flags that apply to any subcommand. */
export interface GlobalFlags {
  /** Skip all confirmations and auto-advance. */
  yolo: boolean;
}

/** Params for the "status" subcommand. */
export interface StatusParams {
  /** Optional objective name to show detailed status for. */
  objective?: string;
}

/** Params for the "next" subcommand. */
export interface NextParams {
  /** Optional objective name. If omitted, uses the active objective. */
  objective?: string;
}

/** Params for the "resume" subcommand. */
export interface ResumeParams {
  /** Objective name to resume. Required. */
  objective: string;
}

/** Params for the "config" subcommand. */
export interface ConfigParams {
  /** Config section to drill into. If omitted, shows full overview. */
  section?: ConfigSection;

  /** Deeper drill-down within a section (e.g., "research" within "pipeline"). */
  subsection?: string;
}

/**
 * Parsed command from user input.
 *
 * Examples:
 *   /twisted-work                    → { subcommand: undefined }
 *   /twisted-work status my-feature  → { subcommand: "status", params: { objective: "my-feature" } }
 *   /twisted-work next --yolo        → { subcommand: "next", flags: { yolo: true } }
 *   /twisted-work config pipeline    → { subcommand: "config", params: { section: "pipeline" } }
 */
export interface ParsedCommand {
  subcommand?: TwistedSubcommand;
  params: StatusParams | NextParams | ResumeParams | ConfigParams | {};
  flags: GlobalFlags;
  raw_args: string;
}
