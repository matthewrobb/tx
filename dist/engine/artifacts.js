/**
 * Artifact satisfaction — checks whether a step's required artifacts exist.
 *
 * An artifact is "satisfied" when:
 * 1. The file exists on disk, AND
 * 2. If a content predicate is specified, it also passes.
 */
import { existsSync } from "fs";
import { join } from "path";
/**
 * Check whether a single artifact is satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifact - The artifact reference to check.
 */
export function artifactSatisfied(epicDir, artifact) {
    const fullPath = join(epicDir, artifact.path);
    if (!existsSync(fullPath))
        return false;
    // Content predicates are evaluated separately by the predicate engine.
    // Here we only check file existence.
    return true;
}
/**
 * Check whether all artifacts in a list are satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifacts - Artifact references to check.
 */
export function allArtifactsSatisfied(epicDir, artifacts) {
    return artifacts.every((a) => artifactSatisfied(epicDir, a));
}
/**
 * Return only the artifacts that are NOT yet satisfied.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param artifacts - Artifact references to check.
 */
export function missingArtifacts(epicDir, artifacts) {
    return artifacts.filter((a) => !artifactSatisfied(epicDir, a));
}
//# sourceMappingURL=artifacts.js.map