/**
 * Config resolution — 2-layer merge: defaults + project settings.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Per-project settings (sparse overrides on top of defaults)
 *
 * Result: deepMerge(defaults, projectSettings)
 */
import type { TwistedConfig, TwistedSettings } from "../types/config.js";
/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @returns Fully resolved config with no missing fields
 */
export declare function resolveConfig(settings?: TwistedSettings): TwistedConfig;
//# sourceMappingURL=resolve.d.ts.map