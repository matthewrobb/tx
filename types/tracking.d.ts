/**
 * Tracking strategies — configurable artifact formats.
 *
 * The `tracking` array in TwistedConfig determines which formats are
 * produced across the full pipeline (research → requirements → plan/issues).
 *
 * - `tracking[0]` is the primary strategy (what downstream steps read from)
 * - All entries are written (additive output)
 * - Presets set it via cascade (first wins)
 * - Project settings can override with a longer list
 */

/**
 * Built-in tracking strategies.
 *
 * - "twisted"   — RESEARCH-*.md, REQUIREMENTS.md, ISSUES.md, PLAN.md in objective folder
 * - "nimbalyst"  — nimbalyst-local/plans/ plan doc + nimbalyst-local/tracker/ items
 * - "gstack"     — DESIGN.md + gstack-format PLAN.md + ISSUES.md in objective folder
 */
export type TrackingStrategy = "twisted" | "nimbalyst" | "gstack" | (string & {});
