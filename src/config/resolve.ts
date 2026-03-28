/**
 * Config resolution — 3-layer merge with composable presets.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Presets (first wins — applied right-to-left so first ends up on top)
 * Layer 3: Per-project settings (sparse overrides on top of everything)
 *
 * Result: deepMerge(defaults, ...presets.reverse().map(load), projectSettings)
 */

import type { TwistedConfig } from "../../types/config.js";
import type { TwistedSettings } from "../../types/config.js";
import type { PresetOverrides } from "../../types/preset.js";
import { defaults } from "./defaults.js";
import { deepMerge } from "./merge.js";
import { allPresets } from "../presets/index.js";

/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @param presetRegistry - Map of preset names → overrides (defaults to built-in presets)
 * @returns Fully resolved TwistedConfig with no missing fields
 */
export function resolveConfig(
  settings: TwistedSettings = {},
  presetRegistry: Record<string, PresetOverrides> = allPresets,
): TwistedConfig {
  // Extract preset names from settings
  const presetNames = settings.presets ?? [];

  // Load presets — unknown names are silently skipped
  const presetOverrides = presetNames
    .map((name) => presetRegistry[name])
    .filter((p): p is PresetOverrides => p !== undefined);

  // Apply right-to-left so the first preset has highest priority
  const reversedPresets = [...presetOverrides].reverse();

  // Extract project settings (everything except presets)
  const { presets: _, ...projectSettings } = settings;

  // 3-layer merge
  return deepMerge(
    defaults,
    ...reversedPresets,
    projectSettings as Partial<TwistedConfig>,
  );
}

/**
 * Determine which tracking strategies are active.
 * Returns the resolved tracking array from the config.
 */
export function getActiveStrategies(config: TwistedConfig): string[] {
  return config.tracking;
}

/**
 * Get the primary tracking strategy (first in the array).
 */
export function getPrimaryStrategy(config: TwistedConfig): string {
  return config.tracking[0] ?? "twisted";
}
