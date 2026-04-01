export type ProviderString =
  | "built-in"
  | "skip"
  | "ask"
  | `superpowers:${string}`
  | (string & {});

export interface PhaseProviderConfig {
  provider: ProviderString;
  fallback: ProviderString;
  options: Record<string, unknown>;
}

/** Top-level delegatable phase. */
export type DelegatablePhase = "research";

/** Hook phases within steps. */
export type HookPhase = "arch_review" | "code_review" | "qa" | "ship";

/** Pipeline config — top-level delegatable + hooks. */
export interface PipelineConfig {
  research: PhaseProviderConfig;
  arch_review: PhaseProviderConfig;
  code_review: PhaseProviderConfig;
  qa: PhaseProviderConfig;
  ship: PhaseProviderConfig;
}
