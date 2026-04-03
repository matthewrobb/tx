/**
 * Built-in default TwistedConfig — every field present.
 *
 * This is Layer 1 of the 2-layer config resolution. Project-level
 * settings (Layer 2) are deep-merged on top of these defaults.
 *
 * Four built-in workflows cover the common issue types:
 *   feature: research → scope → plan → build (linear chain)
 *   bug:     reproduce → fix → verify
 *   chore:   do (single step)
 *   spike:   research → recommend
 */
import type { TwistedConfig } from '../types/config.js';
export declare const DEFAULT_CONFIG: TwistedConfig;
//# sourceMappingURL=defaults.d.ts.map