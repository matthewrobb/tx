// src/issues/workflow.ts — Workflow assignment and independent advancement.
//
// Every issue has a workflow_id that determines its step sequence. This module
// handles two concerns:
//   1. Assignment: given an issue type, find the right workflow from config.
//   2. Advancement: advance a single issue one step via txNext, independent of
//      any active cycle. This is the consistent entry point for callers that
//      want to advance an issue — daemon command handlers, cycle logic, CLI.

import type { StoragePort } from '../ports/storage.js';
import type { ProjectionPort } from '../ports/projection.js';
import type { TwistedConfig } from '../types/config.js';
import type { IssueType } from '../types/issue.js';
import type { TxNextResult } from '../engine/state.js';

import { getIssueBySlug, updateIssue } from './crud.js';
import { txNext } from '../engine/state.js';

/**
 * Find the workflow ID for a given issue type from config.
 *
 * Walks `config.workflows` in order and returns the id of the first workflow
 * whose `default_for` includes the given type. Falls back to `'feature'` if
 * no match is found.
 */
export function resolveWorkflowId(type: IssueType, config: TwistedConfig): string {
  const match = config.workflows.find(
    (w) => w.default_for !== undefined && w.default_for.includes(type),
  );
  if (match !== undefined) {
    return match.id;
  }

  // Fallback: this shouldn't happen if config is valid — every IssueType
  // should have a workflow with default_for that includes it. Returning
  // 'feature' keeps the system functional while signaling a config gap.
  return 'feature';
}

/**
 * Change an issue's workflow. Resets step to the first step of the new workflow.
 *
 * Used when promoting a spike or changing issue type.
 * Throws if the slug does not exist or the workflow is not found in config.
 */
export async function reassignWorkflow(
  db: StoragePort,
  slug: string,
  newWorkflowId: string,
  config: TwistedConfig,
): Promise<void> {
  // 1. Validate the new workflow exists in config.
  const workflow = config.workflows.find((w) => w.id === newWorkflowId);
  if (workflow === undefined) {
    throw new Error(`Workflow not found in config: ${newWorkflowId}`);
  }

  // 2. Find the first step — the step with empty or absent `needs`.
  const steps = workflow.steps ?? [];
  const firstStep = steps.find(
    (s) => s.needs === undefined || s.needs.length === 0,
  );
  if (firstStep === undefined) {
    throw new Error(`Workflow ${newWorkflowId} has no step with empty needs`);
  }

  // 3. Load issue by slug so we can get its id.
  const issue = await getIssueBySlug(db, slug);
  if (issue === null) {
    throw new Error(`Issue not found: ${slug}`);
  }

  // 4. Update workflow_id and reset step to the first step.
  await updateIssue(db, issue.id, {
    workflow_id: newWorkflowId,
    step: firstStep.id,
  });
}

/**
 * Advance a single issue one step via txNext.
 *
 * This is the entry point for `tx next <slug>` without a cycle.
 * Callers include daemon command handlers, cycle logic, and the CLI.
 */
export async function advanceIssue(
  db: StoragePort,
  projection: ProjectionPort,
  slug: string,
  resumeResponse?: string,
): Promise<TxNextResult> {
  return txNext(db, projection, {
    issue_slug: slug,
    resume_response: resumeResponse,
  });
}
