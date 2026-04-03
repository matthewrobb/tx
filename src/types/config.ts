// src/types/config.ts — Configuration types for twisted-workflow v4.
//
// Resolution order:
//   1. Built-in defaults (complete TwistedConfig)
//   2. Per-project overrides in .twisted/settings.json (sparse TwistedSettings)
//   Result: deepMerge(defaults, projectSettings ?? {})

import type { IssueType } from './issue.js';
import type { StepDef } from './workflow.js';

/**
 * Deep partial utility — makes all nested properties optional recursively.
 * Used for the sparse override layer (TwistedSettings).
 *
 * Arrays of objects become arrays of DeepPartial<object> so that individual
 * step overrides can be sparse too. Primitive arrays stay as-is.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[K]>
    : T[K];
};

/**
 * A workflow definition embedded in the config file.
 *
 * WorkflowConfig can either define a full workflow inline or extend a
 * built-in workflow by id. When `extends` is set, only the overridden
 * fields need to be provided.
 */
export interface WorkflowConfig {
  id: string;

  /** If set, this config extends a built-in workflow and only overrides differ. */
  extends?: string;

  title?: string;
  steps?: StepDef[];
  default_for?: IssueType[];
}

/**
 * Placeholder for future policy configuration.
 * Policies will control things like branch protection, required approvals, etc.
 */
export interface PolicyConfig {
  // Reserved for future use — intentionally empty.
  // Adding the interface now so the config shape is stable.
  [key: string]: unknown;
}

/** Fully resolved configuration — all fields required. */
export interface TwistedConfig {
  version: '4.0';

  /** Workflow definitions (built-in + user overrides, merged). */
  workflows: WorkflowConfig[];

  /** Skills injected at the start of every pipeline step. */
  context_skills: string[];

  /** Per-step skill overrides: step id -> skill path. */
  step_skills: Record<string, string>;

  /** Per-step review skills: offered after primary skill writes its artifact. */
  step_review_skills: Record<string, string>;

  /** Optional policy configuration — reserved for future use. */
  policies?: PolicyConfig;
}

/**
 * Branded TwistedConfig — produced only by the config validator (S-007).
 *
 * Consuming code that requires validated config takes ValidConfig, preventing
 * accidental use of unvalidated input. The brand is added by the validator
 * after schema + semantic checks pass.
 */
export type ValidConfig = TwistedConfig & { readonly _brand: 'ValidConfig' };

/** What the user writes in .twisted/settings.json — all fields optional. */
export type TwistedSettings = DeepPartial<TwistedConfig>;
