/**
 * Artifact path resolution per tracking strategy.
 *
 * Given a strategy and objective name, returns the file paths
 * for each artifact type (research, requirements, plan, issues, tracker).
 */

import type { TrackingStrategy } from "../../types/tracking.js";
import type { StateConfig } from "../../types/state.js";
import type { DirectoryConfig } from "../../types/directories.js";

export interface ArtifactPaths {
  /** Where research output goes. Array because twisted writes multiple files. */
  research: string | ((agentNumber: number) => string);
  /** Where requirements go. */
  requirements: string;
  /** Where the plan document goes. */
  plan: string;
  /** Where the issue breakdown goes. Null if embedded in plan. */
  issues: string | null;
  /** Where tracker items go. Null if no separate tracker. */
  tracker: string | null;
  /** Design doc (gstack only). */
  design: string | null;
}

/**
 * Resolve the objective directory based on state config and status.
 */
export function objectiveDir(
  objective: string,
  status: "todo" | "in-progress" | "done",
  state: StateConfig,
  directories: DirectoryConfig,
): string {
  if (!state.use_folders) {
    return `${directories.root}/${objective}`;
  }

  switch (status) {
    case "todo":
      return `${state.folder_kanban.todo}/${objective}`;
    case "in-progress":
      return `${state.folder_kanban.in_progress}/${objective}`;
    case "done":
      return `${state.folder_kanban.done}/${objective}`;
  }
}

/**
 * Get artifact paths for a given strategy and objective.
 */
export function getArtifactPaths(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
): ArtifactPaths {
  switch (strategy) {
    case "twisted":
      return {
        research: (n: number) => `${objDir}/RESEARCH-${n}.md`,
        requirements: `${objDir}/REQUIREMENTS.md`,
        plan: `${objDir}/PLAN.md`,
        issues: `${objDir}/ISSUES.md`,
        tracker: null,
        design: null,
      };

    case "nimbalyst":
      // objDir unused — nimbalyst paths are project-relative
      // objective encoded in filename, not directory
      return {
        research: `nimbalyst-local/plans/${objective}.md`,
        requirements: `nimbalyst-local/plans/${objective}.md`,
        plan: `nimbalyst-local/plans/${objective}.md`,
        issues: null, // issues embedded as checklist in plan doc
        tracker: `nimbalyst-local/tracker/tasks.md`,
        design: null,
      };

    case "gstack":
      return {
        research: `${objDir}/DESIGN.md`,
        requirements: `${objDir}/DESIGN.md`,
        plan: `${objDir}/PLAN.md`,
        issues: `${objDir}/ISSUES.md`, // always written for execute
        tracker: null,
        design: `${objDir}/DESIGN.md`,
      };

    default:
      // Unknown strategy falls back to twisted
      return getArtifactPaths("twisted", objective, objDir);
  }
}

/**
 * Get all artifact paths for all active tracking strategies.
 */
export function getAllArtifactPaths(
  strategies: TrackingStrategy[],
  objective: string,
  objDir: string,
): { primary: ArtifactPaths; additional: ArtifactPaths[] } {
  const [primaryStrategy, ...additionalStrategies] = strategies;
  return {
    primary: getArtifactPaths(primaryStrategy ?? "twisted", objective, objDir),
    additional: additionalStrategies.map((s) =>
      getArtifactPaths(s, objective, objDir),
    ),
  };
}
