/**
 * Root configuration type for twisted-workflow v3.
 *
 * TwistedConfig is the fully resolved config (all fields required).
 * TwistedSettings is what the user writes in settings.json (all fields optional).
 *
 * Resolution order:
 *   1. Built-in defaults (complete TwistedConfig)
 *   2. Per-project overrides (sparse, everything in settings.json)
 *
 * Result: deepMerge(defaults, projectSettings ?? {})
 */

import type { ToolsConfig } from "./tools";
import type { PipelineConfig } from "./pipeline";
import type { ExecutionConfig } from "./execution";
import type { PhasesConfig } from "./phases";
import type { DecomposeConfig } from "./decompose";
import type { TemplatesConfig } from "./templates";
import type { StateConfig } from "./state";
import type { FlowConfig } from "./flow";
import type { WritingConfig } from "./writing";
import type { DirectoryConfig, FilePathConfig, NamingConfig } from "./directories";
import type { StringTemplates } from "./strings";

/**
 * Deep partial utility — makes all nested properties optional.
 * Used for sparse override layers (per-project settings).
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[K]>
    : T[K];
};

/** Fully resolved configuration — all fields present and required. */
export interface TwistedConfig {
  /** Schema version. */
  version: "3.0";

  /** Detected external tools. */
  tools: ToolsConfig;

  /** Provider routing for delegatable pipeline phases. */
  pipeline: PipelineConfig;

  /** Parallel execution settings. */
  execution: ExecutionConfig;

  /** Model/effort/context per core step. */
  phases: PhasesConfig;

  /** Plan step settings (estimation, thresholds, categories). */
  plan: DecomposeConfig;

  /** Issue and changelog templates. */
  templates: TemplatesConfig;

  /** State management (folder kanban toggle). */
  state: StateConfig;

  /** Auto-advance and pause conditions. */
  flow: FlowConfig;

  /** Writing quality skill. */
  writing: WritingConfig;

  /** Directory paths. */
  directories: DirectoryConfig;

  /** File paths and sort orders. */
  files: FilePathConfig;

  /** Objective naming configuration. */
  naming: NamingConfig;

  /** Configurable string templates for all user-facing text. */
  strings: StringTemplates;

  /**
   * Skills injected at the start of every pipeline step.
   * Example: ["/my-project-nav"] for project-specific navigation.
   */
  context_skills: string[];
}

/**
 * What the user writes in `.twisted/settings.json`.
 *
 * All fields are optional (sparse overrides on top of defaults).
 */
export type TwistedSettings = DeepPartial<TwistedConfig>;

// --- v4 config types ---

import type { EpicType, TypeConfig } from "./epic";

/**
 * Reference to an artifact file that a step produces or requires.
 * Satisfaction = file exists (+ optional predicate passes).
 */
export interface ArtifactRef {
  /** Path relative to the epic's lane directory. */
  path: string;
  /** Optional predicate name to validate content (e.g. "non-empty"). */
  predicate?: string;
}

/**
 * A named predicate with optional arguments.
 * Predicates are evaluated by the engine to determine step readiness.
 */
export interface PredicateRef {
  /** Predicate name (e.g. "tasks.all_done", "artifact.exists"). */
  name: string;
  args?: Record<string, unknown>;
}

/** Configuration for a single step within a lane. */
export interface StepConfig {
  name: string;
  /** Artifacts this step produces (written on completion). */
  produces?: ArtifactRef[];
  /** Artifacts required before this step can begin. */
  requires?: ArtifactRef[];
  /** Predicates that must pass for this step to be considered complete. */
  exit_when?: PredicateRef[];
  /** Prompt template for agent steps. */
  prompt?: string;
}

/** Configuration for one of the 6 filesystem lanes. */
export interface LaneConfig {
  /** Display name (e.g. "backlog", "ready", "active"). */
  name: string;
  /** Directory name with numeric prefix (e.g. "0-backlog", "2-active"). */
  dir: string;
  /** Steps within this lane. */
  steps: StepConfig[];
  /** Predicates that must pass before an epic can enter this lane. */
  entry_requires?: PredicateRef[];
}

/** Fully resolved v4 configuration. */
export interface TwistedConfigV4 {
  version: "4.0";
  /** Lane definitions in traversal order. */
  lanes: LaneConfig[];
  /** Per-type lane sequences. */
  types: TypeConfig[];
  /** Skills injected at the start of every pipeline step. */
  context_skills: string[];
}

/** What the user writes in `.twisted/settings.json` for v4. */
export type TwistedSettingsV4 = Partial<TwistedConfigV4>;

// Re-export all types for convenient access from a single import.
export type {
  ToolsConfig,
  ToolName,
  DetectedTools,
} from "./tools";

export type {
  PipelineConfig,
  PhaseProviderConfig,
  ProviderString,
  DelegatablePhase,
  CorePhase,
  PipelinePhase,
  PipelineOrder,
} from "./pipeline";

export type {
  ExecutionConfig,
  ExecutionStrategy,
  MergeStrategy,
  ReviewFrequency,
  TestRequirement,
  WorktreeTiers,
} from "./execution";

export type {
  PhasesConfig,
  PhaseSettings,
  ModelName,
  EffortLevel,
  ContextSize,
  PhaseMode,
} from "./phases";

export type {
  DecomposeConfig,
  EstimationScale,
  ComplexityThresholds,
  InterrogationCategory,
  DefaultCategory,
  FibonacciValue,
  TShirtSize,
} from "./decompose";

export type {
  TemplatesConfig,
  IssueTemplate,
  IssueField,
  IssueFieldType,
  ChangelogTemplate,
  DefaultIssueFieldName,
} from "./templates";

export type {
  StateConfig,
  ObjectiveState,
  ObjectiveStatus,
  ObjectiveStep,
  StepTransition,
  StepSequence,
  FolderKanbanConfig,
} from "./state";

export type {
  FlowConfig,
  PauseReason,
} from "./flow";

export type { WritingConfig } from "./writing";

export type {
  DirectoryConfig,
  FilePathConfig,
  NamingConfig,
} from "./directories";

export type {
  TwistedSubcommand,
  ConfigSection,
  PipelineSection,
  GlobalFlags,
  StatusParams,
  NextParams,
  ResumeParams,
  ConfigParams,
  ParsedCommand,
} from "./commands";

export type {
  StringTemplates,
  CommitMessageTemplates,
  HandoffMessageTemplates,
  StatusLineTemplate,
  StatusDetailTemplate,
  PhaseRecommendationTemplate,
  ResearchSectionTemplate,
  ResearchAgentPromptTemplate,
  ExecutionAgentPromptTemplate,
  InterrogationPromptTemplate,
} from "./strings";
