import type { PackageResolverPort, ResolvedPackage } from '../../ports/packages.js';
export declare class NpmPackageResolver implements PackageResolverPort {
    private readonly baseDir;
    constructor(baseDir: string);
    /** Expose the base dir so callers can construct manifest paths. */
    getBaseDir(): string;
    /**
     * Install a git repo that has no package.json (e.g. mattpocock/skills).
     *
     * Shallow-clones the repo into node_modules/{name}/, scans for SKILL.md
     * directories, and writes a synthetic package.json so resolve()/discover()
     * work normally.
     */
    installGit(name: string, repoUrl: string, projectId: string): Promise<ResolvedPackage>;
    /**
     * Install a package to the project's package directory.
     *
     * Runs `npm install {packageName} --prefix {installDir} --save`.
     * The install directory is created if it does not already exist.
     */
    install(packageName: string, projectId: string): Promise<ResolvedPackage>;
    /**
     * Resolve an already-installed package by name.
     * Returns null if the package is not installed for this project.
     *
     * Scoped package names (@org/pkg) are joined as path segments — Node's
     * path.join(baseDir, projectId, 'node_modules', '@org', 'pkg') produces the
     * correct path because the `/` in a scoped name is treated as a path separator
     * by path.join when passed as a single argument. Verified: on all platforms
     * path.join('a', '@org/pkg') → 'a/@org/pkg'.
     */
    resolve(packageName: string, projectId: string): Promise<ResolvedPackage | null>;
    /**
     * Discover all installed twisted-workflow packages for a project.
     *
     * Scans {baseDir}/{projectId}/node_modules/ for two layouts:
     *   1. Top-level packages: node_modules/{name}/package.json
     *   2. Scoped packages:    node_modules/@{scope}/{name}/package.json
     *
     * Packages under `@scope/` directories are detected by checking whether an
     * entry starts with `@`. For each such entry, we descend one level and read
     * every sub-entry. This handles all valid scoped npm package layouts.
     *
     * Packages are included in the result only if isTwistedPackage() returns true
     * (i.e., they have a `twisted` field or list "twisted-workflow" in keywords).
     */
    discover(projectId: string): Promise<ResolvedPackage[]>;
}
/**
 * Create a resolver using ~/.twisted/projects/ as the base directory.
 * This is the standard per-user install location for project-scoped packages.
 */
export declare function createNpmResolver(): NpmPackageResolver;
//# sourceMappingURL=resolver.d.ts.map