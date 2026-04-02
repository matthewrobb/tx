/**
 * Complete built-in defaults — every TwistedConfig field present.
 * This is Layer 1 of the 2-layer config resolution.
 */
import type { TwistedConfig } from "../types/config.js";
/**
 * Built-in defaults — artifact-driven engine with 6-lane filesystem.
 *
 * Lane model:
 *   0-backlog: understand the work (research → scope → estimate)
 *   1-ready:   break it down (plan → estimate-tasks → decompose)
 *   2-active:  do the work (build)
 *   3-review:  review (release types only)
 *   4-done:    complete
 *   5-archive: abandoned / superseded
 */
export declare const defaults: TwistedConfig;
//# sourceMappingURL=defaults.d.ts.map