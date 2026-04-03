// src/adapters/npm/merge.ts — 3-layer config merge for skill/persona packages.
//
// Resolution order:
//   Layer 1: Built-in defaults (base TwistedConfig, already fully resolved)
//   Layer 2: Package manifest overrides (workflows from the npm package)
//   Layer 3: User config overrides (project settings.json, wins on all conflicts)
//
// Workflow merging follows the same append strategy as resolveConfig: package
// workflows are appended to the base list, then user overrides are applied on
// top. A workflow id collision between the package and the user config is
// resolved in favour of the user (Layer 3 wins).

import type { TwistedConfig, WorkflowConfig } from '../../types/config.js';
import type { ResolvedPackage } from '../../ports/packages.js';
import { deepMerge } from '../../config/merge.js';

/**
 * Merge a package manifest's workflow contributions into a base config,
 * then apply user overrides.
 *
 * @param base          - Fully resolved base config (Layer 1, e.g. result of resolveConfig).
 * @param pkg           - Installed package whose manifest may contribute workflows.
 * @param userOverrides - Sparse user overrides (Layer 3). When omitted, base + package
 *                        manifests are returned without further modification.
 * @returns A new TwistedConfig with all three layers applied. The input objects
 *          are never mutated.
 */
export function mergeWithPackage(
  base: TwistedConfig,
  pkg: ResolvedPackage,
  userOverrides?: Partial<TwistedConfig>,
): TwistedConfig {
  // Layer 2: append package workflows to the base list.
  // Package workflows are new entries — we do not attempt to merge them with
  // existing built-in workflows because the package is the authoritative
  // definition for its own workflow ids. If the same id appears in Layer 3
  // (user overrides), the user's version wins via the merge below.
  const packageWorkflows: WorkflowConfig[] = [...(pkg.manifest.workflows ?? [])];

  const withPackage: TwistedConfig = {
    ...base,
    workflows: [...base.workflows, ...packageWorkflows],
  };

  if (!userOverrides) {
    return withPackage;
  }

  // Layer 3: apply user overrides on top of the base+package config.
  // Workflows use id-based merge: user entry replaces any existing entry with
  // the same id; new ids are appended.
  const { workflows: userWorkflows, ...userScalarOverrides } = userOverrides;

  // Deep-merge scalar fields (context_skills, step_skills, step_review_skills, etc.)
  const {
    workflows: baseWorkflows,
    ...baseScalars
  } = withPackage;

  const mergedScalars = deepMerge(
    baseScalars as unknown as Record<string, unknown>,
    userScalarOverrides as Record<string, unknown>,
  ) as unknown as Omit<TwistedConfig, 'workflows'>;

  const mergedWorkflows = mergeUserWorkflows(baseWorkflows, userWorkflows);

  return {
    ...mergedScalars,
    workflows: mergedWorkflows,
  };
}

/**
 * Apply user workflow overrides on top of the current workflow list.
 *
 * - Same id: user entry replaces the existing entry entirely.
 * - New id: appended after the existing entries.
 */
function mergeUserWorkflows(
  current: WorkflowConfig[],
  userWorkflows: WorkflowConfig[] | undefined,
): WorkflowConfig[] {
  if (!userWorkflows || userWorkflows.length === 0) {
    return [...current];
  }

  const byId = new Map<string, WorkflowConfig>();
  for (const wf of current) {
    byId.set(wf.id, wf);
  }

  const appended: WorkflowConfig[] = [];

  for (const userWf of userWorkflows) {
    if (byId.has(userWf.id)) {
      // User version replaces existing — preserve title/steps from existing
      // where user does not provide them.
      const existing = byId.get(userWf.id)!;
      byId.set(userWf.id, { ...existing, ...userWf });
    } else {
      appended.push(userWf);
    }
  }

  // Rebuild in original order, then add new workflows.
  const result: WorkflowConfig[] = [];
  for (const wf of current) {
    result.push(byId.get(wf.id) ?? wf);
  }
  result.push(...appended);

  return result;
}
