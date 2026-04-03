/**
 * Config resolution — 2-layer merge: defaults + project settings.
 *
 * Layer 1: Built-in defaults (complete TwistedConfig)
 * Layer 2: Per-project settings (sparse overrides on top of defaults)
 *
 * Workflow merging strategy:
 *   - If a user workflow has `extends`, apply the base workflow's fields first,
 *     then overlay user fields.
 *   - If a user workflow has the same `id` as a built-in, merge at the field level
 *     (user fields win, built-in fields fill gaps).
 *   - New user workflows (unknown id, no extends) are appended as-is.
 */
import type { TwistedConfig, TwistedSettings } from '../types/config.js';
/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides).
 *                   When omitted, returns DEFAULT_CONFIG unchanged.
 * @returns Fully resolved config with no missing fields.
 */
export declare function resolveConfig(settings?: TwistedSettings): TwistedConfig;
//# sourceMappingURL=resolve.d.ts.map