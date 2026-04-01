/**
 * Config presets — pre-defined sparse overrides on defaults.
 *
 * Three-layer resolution:
 *   Layer 1: Built-in defaults (complete, valid config)
 *   Layer 2: Preset (optional sparse delta from defaults)
 *   Layer 3: Per-project settings (optional sparse delta from preset)
 *
 * Resolution: deepMerge(defaults, presets[name] ?? {}, projectSettings ?? {})
 */

import type { TwistedConfig } from "./config";

/** Built-in preset names. */
export type BuiltInPresetName =
  | "twisted"
  | "superpowers"
  | "minimal";

/** Preset name — built-in or custom string. */
export type PresetName = BuiltInPresetName | (string & {});

/**
 * A preset is a partial config — only the fields that differ from defaults.
 * Omits `presets` and `version` to prevent circular nesting.
 */
export type PresetOverrides = DeepPartial<Omit<TwistedConfig, "presets" | "version">>;

/** Map of built-in preset names to their sparse overrides. */
export type BuiltInPresets = Record<BuiltInPresetName, PresetOverrides>;

/**
 * Deep partial utility — makes all nested properties optional.
 * Used for sparse override layers (presets and per-project settings).
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[K]>
    : T[K];
};
