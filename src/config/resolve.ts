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

import type { TwistedConfig, TwistedSettings, WorkflowConfig, DeepPartial } from '../types/config.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { deepMerge } from './merge.js';

/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides).
 *                   When omitted, returns DEFAULT_CONFIG unchanged.
 * @returns Fully resolved config with no missing fields.
 */
export function resolveConfig(
  settings?: TwistedSettings,
): TwistedConfig {
  if (!settings) return { ...DEFAULT_CONFIG };

  // Merge top-level scalar/object fields (version, context_skills, step_skills, etc.)
  // but handle workflows separately since they need id-based merging.
  const { workflows: userWorkflows, ...userRest } = settings;
  const { workflows: defaultWorkflows, ...defaultRest } = DEFAULT_CONFIG;

  const mergedScalars = deepMerge(
    defaultRest as unknown as Record<string, unknown>,
    userRest as Record<string, unknown>,
  ) as unknown as Omit<TwistedConfig, 'workflows'>;

  const mergedWorkflows = mergeWorkflows(defaultWorkflows, userWorkflows);

  return {
    ...mergedScalars,
    workflows: mergedWorkflows,
  };
}

/**
 * Merge built-in and user workflows.
 *
 * 1. Start with a copy of all built-in workflows, indexed by id.
 * 2. For each user workflow:
 *    - If `extends` is set, resolve the base workflow and overlay user fields.
 *    - If the id matches a built-in, merge user fields on top of the built-in.
 *    - Otherwise, append as a new workflow.
 * 3. Return the combined list (built-ins first, then new user workflows).
 */
function mergeWorkflows(
  defaults: WorkflowConfig[],
  userWorkflows?: Array<DeepPartial<WorkflowConfig>>,
): WorkflowConfig[] {
  if (!userWorkflows || userWorkflows.length === 0) {
    return [...defaults];
  }

  // Index defaults by id for lookup
  const defaultsById = new Map<string, WorkflowConfig>();
  for (const wf of defaults) {
    defaultsById.set(wf.id, wf);
  }

  // Track which default workflows are overridden by user
  const overridden = new Set<string>();
  const newWorkflows: WorkflowConfig[] = [];

  for (const userWf of userWorkflows) {
    if (!userWf.id) continue; // Skip workflows without an id

    // Determine the base workflow (extends or same-id built-in)
    const extendsId = userWf.extends;
    const baseId = extendsId ?? userWf.id;
    const base = defaultsById.get(baseId);

    if (base) {
      // Merge scalar fields — spread user overrides onto base.
      // Steps are handled separately (array replacement, not field merge).
      const { steps: userSteps, ...userScalars } = stripUndefined(userWf);
      const merged: WorkflowConfig = {
        ...base,
        ...userScalars,
        id: userWf.id, // User id always wins (important for extends)
        // If user provides steps, use them (full replacement). Otherwise inherit base steps.
        steps: userSteps !== undefined ? (userSteps as WorkflowConfig['steps']) : base.steps,
      };

      if (baseId === userWf.id) {
        // Same-id override — replace the built-in
        overridden.add(baseId);
        defaultsById.set(userWf.id, merged);
      } else {
        // Extends — new workflow based on another
        newWorkflows.push(merged);
      }
    } else {
      // New workflow, no matching built-in
      newWorkflows.push(userWf as WorkflowConfig);
    }
  }

  // Build result: defaults (possibly overridden) + new user workflows
  const result: WorkflowConfig[] = [];
  for (const wf of defaults) {
    const overriddenWf = defaultsById.get(wf.id);
    result.push(overriddenWf ?? wf);
  }
  result.push(...newWorkflows);

  return result;
}

/**
 * Strip undefined values from a partial object so they don't overwrite
 * base values during spread. Returns a new object.
 */
function stripUndefined<T extends Record<string, unknown>>(
  obj: Partial<T>,
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}
