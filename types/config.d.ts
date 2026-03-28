/**
 * Root configuration type for twisted-workflow v2.
 *
 * TwistedConfig is the fully resolved config (all fields required).
 * TwistedSettings is what the user writes in settings.json (all fields optional).
 *
 * Resolution order:
 *   1. Built-in defaults (complete TwistedConfig)
 *   2. Preset overrides (sparse, keyed by `preset` field)
 *   3. Per-project overrides (sparse, everything else in settings.json)
 *
 * Result: deepMerge(defaults, presets[name] ?? {}, projectSettings ?? {})
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
import type { PresetName, DeepPartial } from "./preset";
import type { StringTemplates } from "./strings";
import type { NimbalystConfig } from "./nimbalyst";
import type { TrackingStrategy } from "./tracking";

/** Fully resolved configuration — all fields present and required. */
export interface TwistedConfig {
  /** Schema version. */
  version: "2.0";

  /** Active presets. First wins — earlier presets override later ones on conflict. */
  presets: PresetName[];

  /**
   * Tracking strategies. Determines artifact formats across the full pipeline.
   * First entry = primary (what downstream steps read from). All entries written.
   * Default: ["twisted"].
   */
  tracking: TrackingStrategy[];

  /** Detected external tools. */
  tools: ToolsConfig;

  /** Provider routing for delegatable pipeline phases. */
  pipeline: PipelineConfig;

  /** Parallel execution settings. */
  execution: ExecutionConfig;

  /** Model/effort/context per core step. */
  phases: PhasesConfig;

  /** Decompose step settings (estimation, thresholds, categories). */
  decompose: DecomposeConfig;

  /** Issue and changelog templates. */
  templates: TemplatesConfig;

  /** State management (folder kanban toggle). */
  state: StateConfig;

  /** Auto-advance and pause conditions. */
  flow: FlowConfig;

  /** Writing quality skill. */
  writing: WritingConfig;

  /** Nimbalyst integration (experimental). */
  nimbalyst: NimbalystConfig;

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
 * All fields are optional (sparse overrides). The `presets` field selects
 * base presets applied left-to-right. All other fields override the resolved result.
 */
export type TwistedSettings = DeepPartial<TwistedConfig> & {
  presets?: PresetName[];
};

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
  ToolsUsed,
  FolderKanbanConfig,
} from "./state";

export type {
  FlowConfig,
  PauseReason,
} from "./flow";

export type { WritingConfig } from "./writing";

export type {
  NimbalystConfig,
  NimbalystPlanFrontmatter,
  NimbalystStatus,
  NimbalystPlanType,
  NimbalystPriority,
  NimbalystTrackerTag,
  NimbalystTrackerStatus,
  NimbalystTrackerType,
} from "./nimbalyst";

export type { TrackingStrategy } from "./tracking";

export type {
  DirectoryConfig,
  FilePathConfig,
  NamingConfig,
} from "./directories";

export type {
  PresetName,
  BuiltInPresetName,
  PresetOverrides,
  BuiltInPresets,
  DeepPartial,
} from "./preset";

export type {
  ObjectiveFrontmatter,
  RequirementsFrontmatter,
  IssuesFrontmatter,
  PlanFrontmatter,
  ResearchFrontmatter,
} from "./frontmatter";

export type {
  ResearchFile,
  RequirementsFile,
  IssuesFile,
  PlanFile,
  ExecutionLog,
  AgentLogEntry,
  ObjectiveArtifacts,
} from "./artifacts";

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

export type {
  Issue,
  IssueGroup,
  AgentAssignment,
  ComplexityEstimate,
  DependencyGraph,
} from "./issues";
