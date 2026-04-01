/**
 * Config resolution — 3-layer merge with composable presets.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Presets (first wins — applied right-to-left so first ends up on top)
 * Layer 3: Per-project settings (sparse overrides on top of everything)
 *
 * Result: deepMerge(defaults, ...presets.reverse().map(load), projectSettings)
 */

import type { TwistedConfig, TwistedConfigV4, TwistedSettingsV4 } from "../../types/config.js";
import type { TwistedSettings } from "../../types/config.js";
import type { PresetOverrides } from "../../types/preset.js";
import { defaults, defaultsV4 } from "./defaults.js";
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
    .map((name: string) => presetRegistry[name])
    .filter((p: PresetOverrides | undefined): p is PresetOverrides => p !== undefined);

  // Apply right-to-left so the first preset has highest priority
  const reversedPresets = [...presetOverrides].reverse();

  // Extract project settings (everything except presets)
  const { presets: _, ...projectSettings } = settings;

  // 3-layer merge — cast through unknown to satisfy Record<string, unknown> constraint
  return deepMerge(
    defaults as unknown as Record<string, unknown>,
    ...reversedPresets,
    projectSettings as Partial<TwistedConfig>,
  ) as unknown as TwistedConfig;
}

/**
 * Resolve a complete v4 TwistedConfigV4 from sparse user settings.
 *
 * Uses the same 3-layer merge strategy as resolveConfig but with v4 defaults.
 */
export function resolveConfigV4(
  settings: TwistedSettingsV4 = {},
  presetRegistry: Record<string, Partial<TwistedConfigV4>> = {},
): TwistedConfigV4 {
  const presetNames = settings.presets ?? [];

  const presetOverrides = presetNames
    .map((name: string) => presetRegistry[name])
    .filter((p): p is Partial<TwistedConfigV4> => p !== undefined);

  const reversedPresets = [...presetOverrides].reverse();

  const { presets: _, ...projectSettings } = settings;

  return deepMerge(
    defaultsV4 as unknown as Record<string, unknown>,
    ...reversedPresets,
    projectSettings,
  ) as unknown as TwistedConfigV4;
}
