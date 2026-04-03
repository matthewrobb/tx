interface SkillFile {
    package: string;
    skill: string;
    path: string;
}
type Manifest = Record<string, any>;
/**
 * Return only skills that don't yet have a step binding in the manifest.
 *
 * A skill needs a suggestion when:
 * - It's not in the manifest at all (newly installed)
 * - Its `suggested_step_binding` is null or undefined
 */
export declare function filterUnboundSkills(installed: SkillFile[], manifest: Manifest): SkillFile[];
export {};
//# sourceMappingURL=install-filter.d.ts.map