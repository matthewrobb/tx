// src/migration/rules.ts — Migration rule types and validation for workflow migrations.
//
// When a workflow changes (steps renamed, added, removed, reordered), existing
// open issues need their `step` field updated. Migration rules are declarative
// descriptions of how to transform issue step pointers.

import type { WorkflowConfig } from '../types/config.js';

// ── Rule types ───────────────────────────────────────────────────────────

/** A single migration rule — describes how to transform issue step pointers. */
export type MigrationRule =
  | { kind: 'rename_step'; from: string; to: string }
  | { kind: 'remove_step'; step: string; redirect_to: string }
  | { kind: 'reset_to_start'; workflow_id: string }
  | { kind: 'reassign_workflow'; from_workflow: string; to_workflow: string; step_map: Record<string, string> };

export interface MigrationPlan {
  workflow_id: string;
  rules: MigrationRule[];
  description: string;
}

// ── Validation ───────────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

/**
 * Validate that a migration plan is internally consistent against the old
 * and new workflow definitions.
 *
 * Checks:
 *   - rename_step: `to` must exist in the new workflow's steps
 *   - remove_step: `redirect_to` must exist in the new workflow's steps
 *   - reset_to_start: new workflow must have at least one step
 *   - reassign_workflow: step_map values must all exist in the new workflow,
 *     and step_map keys must cover every step in the old workflow
 */
export function validateMigrationPlan(
  plan: MigrationPlan,
  oldWorkflow: WorkflowConfig,
  newWorkflow: WorkflowConfig,
): ValidationResult {
  const errors: string[] = [];
  const newStepIds = new Set((newWorkflow.steps ?? []).map((s) => s.id));
  const oldStepIds = new Set((oldWorkflow.steps ?? []).map((s) => s.id));

  for (const rule of plan.rules) {
    switch (rule.kind) {
      case 'rename_step': {
        if (!newStepIds.has(rule.to)) {
          errors.push(
            `rename_step: target step '${rule.to}' does not exist in the new workflow`,
          );
        }
        break;
      }

      case 'remove_step': {
        if (!newStepIds.has(rule.redirect_to)) {
          errors.push(
            `remove_step: redirect target '${rule.redirect_to}' does not exist in the new workflow`,
          );
        }
        break;
      }

      case 'reset_to_start': {
        if (newWorkflow.steps === undefined || newWorkflow.steps.length === 0) {
          errors.push(
            `reset_to_start: new workflow '${rule.workflow_id}' has no steps`,
          );
        }
        break;
      }

      case 'reassign_workflow': {
        // All step_map values must exist in the new workflow
        for (const [oldStep, newStep] of Object.entries(rule.step_map)) {
          if (!newStepIds.has(newStep)) {
            errors.push(
              `reassign_workflow: step_map value '${newStep}' (for old step '${oldStep}') does not exist in the new workflow`,
            );
          }
        }

        // step_map keys must cover all steps in the old workflow
        for (const oldStep of oldStepIds) {
          if (!(oldStep in rule.step_map)) {
            errors.push(
              `reassign_workflow: step_map is missing mapping for old step '${oldStep}'`,
            );
          }
        }
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}
