/**
 * Config resolution — 2-layer merge: defaults + project settings.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Per-project settings (sparse overrides on top of defaults)
 *
 * Result: deepMerge(defaults, projectSettings)
 */

import type { TwistedConfig, TwistedSettings } from "../types/config.js";
import { defaults } from "./defaults.js";
import { deepMerge } from "./merge.js";

/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @returns Fully resolved config with no missing fields
 */
export function resolveConfig(
  settings: TwistedSettings = {},
): TwistedConfig {
  return deepMerge(
    defaults as unknown as Record<string, unknown>,
    settings,
  ) as unknown as TwistedConfig;
}
