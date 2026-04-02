/**
 * Artifact satisfaction — checks whether a step's required artifacts exist.
 *
 * An artifact is "satisfied" when:
 * 1. The file exists on disk, AND
 * 2. If a content predicate is specified, it also passes.
 */
import type { ArtifactRef } from "../types/config.js";
/**
 * Check whether a single artifact is satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifact - The artifact reference to check.
 */
export declare function artifactSatisfied(epicDir: string, artifact: ArtifactRef): boolean;
/**
 * Check whether all artifacts in a list are satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifacts - Artifact references to check.
 */
export declare function allArtifactsSatisfied(epicDir: string, artifacts: ArtifactRef[]): boolean;
/**
 * Return only the artifacts that are NOT yet satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifacts - Artifact references to check.
 */
export declare function missingArtifacts(epicDir: string, artifacts: ArtifactRef[]): ArtifactRef[];
//# sourceMappingURL=artifacts.d.ts.map