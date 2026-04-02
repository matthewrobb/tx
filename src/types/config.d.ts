/**
 * Root configuration type for twisted-workflow.
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

import type { EpicType, TypeConfig } from "./epic";

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

/** Fully resolved configuration. */
export interface TwistedConfig {
  version: "4.0";
  /** Lane definitions in traversal order. */
  lanes: LaneConfig[];
  /** Per-type lane sequences. */
  types: TypeConfig[];
  /** Skills injected at the start of every pipeline step. */
  context_skills: string[];
  /** Per-step skill overrides: step name → skill path (e.g. "skills/mattpocock/tdd"). */
  step_skills: Record<string, string>;
  /** Per-step review skill: offered to the user after the primary skill writes its artifact. */
  step_review_skills: Record<string, string>;
}

/** What the user writes in `.twisted/settings.json`. */
export type TwistedSettings = Partial<TwistedConfig>;
