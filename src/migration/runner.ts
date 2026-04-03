// src/migration/runner.ts — Applies declarative migration rules to live issues.
//
// applyMigration() runs inside a DB transaction (all-or-nothing).
// previewMigration() is read-only — same logic, no writes.

import type { StoragePort } from '../ports/storage.js';
import type { Issue } from '../types/issue.js';
import { listIssues, updateIssue } from '../issues/crud.js';
import type { MigrationPlan, MigrationRule } from './rules.js';

// ── Result types ─────────────────────────────────────────────────────────

export interface MigrationResult {
  /** Issues whose step (or workflow) was updated. */
  migrated: number;
  /** Issues not affected (already done/archived, or no rule matched). */
  skipped: number;
  /** Descriptions of issues that couldn't be migrated (unmatched step). */
  errors: string[];
}

export interface MigrationPreviewEntry {
  issue_slug: string;
  from_step: string;
  to_step: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

/**
 * Resolve the first step of a workflow by scanning the plan's target workflow.
 *
 * For reset_to_start we need the new workflow's first step, but we only
 * have the plan (not the full config). The caller must ensure the
 * workflow_id in the rule points to a valid workflow with steps.
 * Since we don't have the config here, we accept the step as a parameter
 * derived from the rule.
 *
 * Decision: Rather than importing the config layer (which creates a
 * coupling from migration → config → defaults), reset_to_start rules
 * store the target workflow_id and we look up the first step at the
 * call site. This keeps the runner config-agnostic.
 */

/** Apply rules to a single issue, returning the new step (or null if no rule matches). */
function applyRules(
  issue: Issue,
  rules: MigrationRule[],
  firstStepLookup: Map<string, string>,
): { newStep: string; newWorkflowId?: string } | null {
  for (const rule of rules) {
    switch (rule.kind) {
      case 'rename_step': {
        if (issue.step === rule.from) {
          return { newStep: rule.to };
        }
        break;
      }

      case 'remove_step': {
        if (issue.step === rule.step) {
          return { newStep: rule.redirect_to };
        }
        break;
      }

      case 'reset_to_start': {
        // All matching issues reset to the workflow's first step.
        const firstStep = firstStepLookup.get(rule.workflow_id);
        if (firstStep !== undefined) {
          return { newStep: firstStep };
        }
        break;
      }

      case 'reassign_workflow': {
        if (issue.workflow_id === rule.from_workflow) {
          const mappedStep = rule.step_map[issue.step];
          if (mappedStep !== undefined) {
            return { newStep: mappedStep, newWorkflowId: rule.to_workflow };
          }
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Build a lookup from workflow_id to its first step name.
 * Needed for reset_to_start rules. We extract the workflow_id from the rule
 * and the caller provides the first step name via config.
 *
 * Decision: We build this lookup once before processing issues so each
 * reset_to_start doesn't need to redundantly search the config.
 */
function buildFirstStepLookup(
  rules: MigrationRule[],
  resolveFirstStep: (workflowId: string) => string | undefined,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const rule of rules) {
    if (rule.kind === 'reset_to_start') {
      const step = resolveFirstStep(rule.workflow_id);
      if (step !== undefined) {
        lookup.set(rule.workflow_id, step);
      }
    }
  }
  return lookup;
}

// ── Default first-step resolver ──────────────────────────────────────────

// Inline import of DEFAULT_CONFIG for resolving first steps.
// This is the only coupling to the config layer and is intentionally
// narrow: we only read workflow step arrays, nothing else.
import { DEFAULT_CONFIG } from '../config/defaults.js';

function defaultFirstStepResolver(workflowId: string): string | undefined {
  const wf = DEFAULT_CONFIG.workflows.find((w) => w.id === workflowId);
  if (!wf?.steps || wf.steps.length === 0) return undefined;
  // First step = the one with empty needs (or first in array order)
  const initial = wf.steps.find(
    (s) => s.needs === undefined || s.needs.length === 0,
  );
  return initial?.id ?? wf.steps[0]?.id;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Apply a migration plan to all open/blocked issues matching the workflow.
 * Runs inside a DB transaction — all-or-nothing.
 *
 * @param db - Storage port (must support transaction())
 * @param plan - Declarative migration rules
 * @param resolveFirstStep - Optional function to resolve a workflow's first step.
 *        Defaults to looking up DEFAULT_CONFIG. Pass a custom resolver in tests
 *        or when using user-defined workflows.
 */
export async function applyMigration(
  db: StoragePort,
  plan: MigrationPlan,
  resolveFirstStep: (workflowId: string) => string | undefined = defaultFirstStepResolver,
): Promise<MigrationResult> {
  const firstStepLookup = buildFirstStepLookup(plan.rules, resolveFirstStep);

  return db.transaction(async (tx) => {
    const result: MigrationResult = { migrated: 0, skipped: 0, errors: [] };

    // Fetch all issues on this workflow (all statuses — we filter below)
    const issues = await listIssues(db, { workflow_id: plan.workflow_id }, tx);

    for (const issue of issues) {
      // Skip done/archived issues — they're not affected by workflow changes
      if (issue.status === 'done' || issue.status === 'archived') {
        result.skipped++;
        continue;
      }

      const match = applyRules(issue, plan.rules, firstStepLookup);

      if (match === null) {
        // No rule matched this issue's current step — record as error
        // but don't fail the whole migration.
        result.errors.push(
          `Issue '${issue.slug}' on step '${issue.step}': no matching rule`,
        );
        continue;
      }

      // Build the update payload
      const update: { step: string; workflow_id?: string } = {
        step: match.newStep,
      };
      if (match.newWorkflowId !== undefined) {
        update.workflow_id = match.newWorkflowId;
      }

      await updateIssue(db, issue.id, update, tx);
      result.migrated++;
    }

    return result;
  });
}

/**
 * Dry-run: return what WOULD change without touching the DB.
 * Read-only — no transaction needed.
 */
export async function previewMigration(
  db: StoragePort,
  plan: MigrationPlan,
  resolveFirstStep: (workflowId: string) => string | undefined = defaultFirstStepResolver,
): Promise<MigrationPreviewEntry[]> {
  const firstStepLookup = buildFirstStepLookup(plan.rules, resolveFirstStep);
  const preview: MigrationPreviewEntry[] = [];

  const issues = await listIssues(db, { workflow_id: plan.workflow_id });

  for (const issue of issues) {
    // Skip done/archived — same filtering as applyMigration
    if (issue.status === 'done' || issue.status === 'archived') {
      continue;
    }

    const match = applyRules(issue, plan.rules, firstStepLookup);
    if (match !== null) {
      preview.push({
        issue_slug: issue.slug,
        from_step: issue.step,
        to_step: match.newStep,
      });
    }
  }

  return preview;
}
