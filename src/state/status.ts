/**
 * Status mapping between twisted-workflow and external tools.
 */

import type { ObjectiveStatus, ObjectiveStep } from "../../types/state.js";
import type { NimbalystStatus, NimbalystPlanType } from "../../types/nimbalyst.js";

// ---------------------------------------------------------------------------
// Nimbalyst status mapping
// ---------------------------------------------------------------------------

/**
 * Map twisted-workflow state to Nimbalyst plan status.
 */
export function toNimbalystStatus(
  status: ObjectiveStatus,
  step: ObjectiveStep,
): NimbalystStatus {
  if (status === "blocked") return "blocked";
  if (status === "done") return "completed";

  switch (step) {
    case "research":
    case "scope":
      return "draft";
    case "arch_review":
    case "decompose":
      return "ready-for-development";
    case "execute":
      return "in-development";
    case "code_review":
    case "qa":
      return "in-review";
    case "ship":
      return "in-review";
    default:
      return "draft";
  }
}

/**
 * Infer Nimbalyst planType from objective content.
 * Falls back to "feature" if no specific type is detected.
 */
export function inferPlanType(description: string): NimbalystPlanType {
  const lower = description.toLowerCase();
  if (lower.includes("bug") || lower.includes("fix")) return "bug-fix";
  if (lower.includes("refactor") || lower.includes("restructure")) return "refactor";
  if (lower.includes("architect") || lower.includes("system design")) return "system-design";
  if (lower.includes("research") || lower.includes("investigate")) return "research";
  return "feature";
}

// ---------------------------------------------------------------------------
// Nimbalyst tracker status mapping
// ---------------------------------------------------------------------------

/**
 * Map issue done state to Nimbalyst tracker status.
 */
export function toTrackerStatus(done: boolean, inProgress = false): string {
  if (done) return "done";
  if (inProgress) return "in-progress";
  return "to-do";
}

// ---------------------------------------------------------------------------
// Progress calculation
// ---------------------------------------------------------------------------

/**
 * Calculate progress percentage.
 */
export function calculateProgress(done: number, total: number | null): number {
  if (!total || total === 0) return 0;
  return Math.round((done / total) * 100);
}
