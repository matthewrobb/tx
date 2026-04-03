// src/cli/commands/install-filter.ts — Filter skills that need step-binding suggestions.

interface SkillFile {
  package: string;
  skill: string;
  path: string;
}

interface ManifestSkill {
  suggested_step_binding?: { step: string; type: string } | null;
  [key: string]: unknown;
}

interface ManifestPackage {
  skills?: Record<string, ManifestSkill>;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Manifest = Record<string, any>;

/**
 * Return only skills that don't yet have a step binding in the manifest.
 *
 * A skill needs a suggestion when:
 * - It's not in the manifest at all (newly installed)
 * - Its `suggested_step_binding` is null or undefined
 */
export function filterUnboundSkills(
  installed: SkillFile[],
  manifest: Manifest,
): SkillFile[] {
  return installed.filter((s) => {
    const pkg = manifest[s.package];
    if (!pkg?.skills) return true;

    const skill = pkg.skills[s.skill];
    if (!skill) return true;

    // null = explicitly needs suggestion. undefined = never set.
    // Any truthy value = already bound.
    return !skill.suggested_step_binding;
  });
}
