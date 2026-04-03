// src/cli/commands/install-filter.ts — Filter skills that need step-binding suggestions.
/**
 * Return only skills that don't yet have a step binding in the manifest.
 *
 * A skill needs a suggestion when:
 * - It's not in the manifest at all (newly installed)
 * - Its `suggested_step_binding` is null or undefined
 */
export function filterUnboundSkills(installed, manifest) {
    return installed.filter((s) => {
        const pkg = manifest[s.package];
        if (!pkg?.skills)
            return true;
        const skill = pkg.skills[s.skill];
        if (!skill)
            return true;
        // null = explicitly needs suggestion. undefined = never set.
        // Any truthy value = already bound.
        return !skill.suggested_step_binding;
    });
}
//# sourceMappingURL=install-filter.js.map