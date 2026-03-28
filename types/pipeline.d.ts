/**
 * Pipeline configuration — provider routing for delegatable phases.
 *
 * Core steps (scope, decompose, execute) are always handled by twisted-workflow.
 * Delegatable phases can be routed to external tools, built-in implementations,
 * or skipped entirely.
 */

/**
 * Provider string format.
 *
 * - "built-in"                    — twisted-workflow's own implementation
 * - "gstack:/office-hours"        — invoke a gstack slash command
 * - "gstack:/review"              — invoke a gstack slash command
 * - "superpowers:brainstorming"   — invoke a Superpowers skill
 * - "nimbalyst:deep-researcher"   — invoke a Nimbalyst skill
 * - "skip"                        — omit this phase entirely
 * - "ask"                         — ask user which provider to use each time
 */
export type ProviderString =
  | "built-in"
  | "skip"
  | "ask"
  | `gstack:/${string}`
  | `superpowers:${string}`
  | `nimbalyst:${string}`
  | (string & {});

/** Configuration for a single delegatable phase. */
export interface PhaseProviderConfig {
  /** Primary provider for this phase. */
  provider: ProviderString;

  /** Fallback if the primary provider is unavailable. */
  fallback: ProviderString;

  /** Provider-specific options passed through to the provider. */
  options: Record<string, unknown>;
}

/** Delegatable phases in the pipeline. */
export type DelegatablePhase =
  | "research"
  | "arch_review"
  | "code_review"
  | "qa"
  | "ship";

/** Core phases that twisted-workflow always owns. */
export type CorePhase = "scope" | "decompose" | "execute";

/** All phases in the pipeline (core + delegatable). */
export type PipelinePhase = CorePhase | DelegatablePhase;

/**
 * Full pipeline execution order.
 * Delegatable phases are interleaved with core phases.
 */
export type PipelineOrder = readonly [
  "research",      // delegatable: before scope
  "scope",         // core
  "arch_review",   // delegatable: after scope, before decompose
  "decompose",     // core
  "execute",       // core
  "code_review",   // delegatable: after execute
  "qa",            // delegatable: after code_review
  "ship",          // delegatable: after qa
];

/** Pipeline provider configuration keyed by delegatable phase. */
export type PipelineConfig = Record<DelegatablePhase, PhaseProviderConfig>;
