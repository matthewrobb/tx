/**
 * Phase settings — model, effort, context, and mode per pipeline step.
 *
 * Each core step (scope, decompose, execute) has recommended defaults.
 * Delegatable steps inherit the settings of the step that invokes them.
 */

/** Claude model identifiers. */
export type ModelName = "opus" | "sonnet" | "haiku";

/** Reasoning effort level (Opus only; ignored by other models). */
export type EffortLevel = "low" | "medium" | "high" | "max";

/** Context window size. "default" uses the model's standard window. */
export type ContextSize = "default" | "1m";

/**
 * Execution mode for a step.
 * - "execute": normal execution, files may be written
 * - "plan": present plan for review before writing files
 */
export type PhaseMode = "execute" | "plan";

/** Settings for a single pipeline step. */
export interface PhaseSettings {
  model: ModelName;
  effort: EffortLevel;
  context: ContextSize;
  mode: PhaseMode;
}

/** Per-step phase settings keyed by core step name. */
export interface PhasesConfig {
  scope: PhaseSettings;
  plan: PhaseSettings;
  build: PhaseSettings;
}
