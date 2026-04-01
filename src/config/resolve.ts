/**
 * Config resolution — 2-layer merge: defaults + project settings.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Per-project settings (sparse overrides on top of defaults)
 *
 * Result: deepMerge(defaults, projectSettings)
 */

import type { TwistedConfig, TwistedConfigV4, TwistedSettingsV4 } from "../../types/config.js";
import type { TwistedSettings } from "../../types/config.js";
import { defaults, defaultsV4 } from "./defaults.js";
import { deepMerge } from "./merge.js";

/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @returns Fully resolved TwistedConfig with no missing fields
 */
export function resolveConfig(
  settings: TwistedSettings = {},
): TwistedConfig {
  return deepMerge(
    defaults as unknown as Record<string, unknown>,
    settings as Partial<TwistedConfig>,
  ) as unknown as TwistedConfig;
}

/**
 * Resolve a complete v4 TwistedConfigV4 from sparse user settings.
 *
 * Uses the same 2-layer merge strategy as resolveConfig but with v4 defaults.
 */
export function resolveConfigV4(
  settings: TwistedSettingsV4 = {},
): TwistedConfigV4 {
  return deepMerge(
    defaultsV4 as unknown as Record<string, unknown>,
    settings,
  ) as unknown as TwistedConfigV4;
}
