// src/adapters/npm/resolver.ts — NpmPackageResolver implementing PackageResolverPort.
//
// Installs and resolves npm packages scoped to individual projects.
// Packages are installed to {baseDir}/{projectId}/node_modules/ to keep
// per-project dependencies isolated from each other and from the global
// tx installation.
//
// Integration tests (S-027) will cover install/resolve/discover. These
// methods require npm and filesystem access that cannot be meaningfully
// unit-tested without those real-world dependencies.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
const execFileAsync = promisify(execFile);
// ── Helpers ───────────────────────────────────────────────────────────────
/**
 * Read and JSON-parse a package.json file at the given path.
 * Returns null if the file does not exist or cannot be parsed.
 */
async function readPackageJson(pkgJsonPath) {
    try {
        const raw = await readFile(pkgJsonPath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/**
 * Map a raw package.json to a PackageManifest.
 */
function toManifest(pkg) {
    return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        skills: pkg.twisted?.skills ?? [],
        personas: pkg.twisted?.personas ?? [],
        entry: pkg.twisted?.entry ?? pkg.main,
        // Cast through unknown — package.json content is untyped JSON. The
        // WorkflowConfig shape is validated by the config validator (S-007) before
        // use; we trust it here only for manifest pass-through.
        workflows: pkg.twisted?.workflows ?? [],
    };
}
/**
 * Determine whether a raw package.json belongs to a tx skill package.
 * A package qualifies if it has a `twisted` field OR lists "@twisted.works/tx"
 * in its keywords array.
 */
function isTwistedPackage(pkg) {
    const hasTwistedField = 'twisted' in pkg && pkg.twisted !== undefined;
    const hasKeyword = Array.isArray(pkg.keywords) && pkg.keywords.includes('@twisted.works/tx');
    return hasTwistedField || hasKeyword;
}
// ── Resolver ──────────────────────────────────────────────────────────────
export class NpmPackageResolver {
    baseDir;
    constructor(
    // Base directory for per-project installs; typically ~/.twisted/projects/
    baseDir) {
        this.baseDir = baseDir;
    }
    /** Expose the base dir so callers can construct manifest paths. */
    getBaseDir() {
        return this.baseDir;
    }
    /**
     * Install a git repo that has no package.json (e.g. mattpocock/skills).
     *
     * Shallow-clones the repo into node_modules/{name}/, scans for SKILL.md
     * directories, and writes a synthetic package.json so resolve()/discover()
     * work normally.
     */
    async installGit(name, repoUrl, projectId) {
        const installDir = path.join(this.baseDir, projectId);
        const pkgDir = path.join(installDir, 'node_modules', name);
        await mkdir(path.dirname(pkgDir), { recursive: true });
        // Clone (or pull if already exists).
        const exists = await readPackageJson(path.join(pkgDir, 'package.json'));
        if (exists !== null) {
            // Already cloned — pull latest.
            await execFileAsync('git', ['-C', pkgDir, 'pull', '--ff-only'], { shell: true });
        }
        else {
            await execFileAsync('git', [
                'clone', '--depth', '1', repoUrl, pkgDir,
            ], { shell: true });
        }
        // Discover skills by scanning for directories containing SKILL.md.
        let entries;
        try {
            entries = await readdir(pkgDir);
        }
        catch {
            entries = [];
        }
        const skills = [];
        for (const entry of entries) {
            if (entry.startsWith('.'))
                continue;
            const skillPath = path.join(pkgDir, entry, 'SKILL.md');
            try {
                await readFile(skillPath);
                skills.push(entry);
            }
            catch {
                // Not a skill directory.
            }
        }
        // Write a synthetic package.json so resolve()/discover() work.
        const syntheticPkg = {
            name,
            version: '0.0.0-git',
            description: `Git-cloned from ${repoUrl}`,
            keywords: ['@twisted.works/tx'],
            twisted: { skills },
        };
        await writeFile(path.join(pkgDir, 'package.json'), JSON.stringify(syntheticPkg, null, 2), 'utf-8');
        return {
            name,
            version: '0.0.0-git',
            installPath: pkgDir,
            manifest: toManifest(syntheticPkg),
        };
    }
    /**
     * Install a package to the project's package directory.
     *
     * Runs `npm install {packageName} --prefix {installDir} --save`.
     * The install directory is created if it does not already exist.
     */
    async install(packageName, projectId) {
        const installDir = path.join(this.baseDir, projectId);
        await mkdir(installDir, { recursive: true });
        // shell: true is required on Windows where npm is a .cmd script.
        await execFileAsync('npm', [
            'install',
            packageName,
            '--prefix', installDir,
            '--save',
        ], { shell: true });
        // Read the installed package's package.json to extract manifest fields.
        // Scoped packages (@org/pkg) map to node_modules/@org/pkg/package.json —
        // path.join handles the separator correctly on all platforms.
        const pkgJsonPath = path.join(installDir, 'node_modules', packageName, 'package.json');
        const pkg = await readPackageJson(pkgJsonPath);
        if (pkg === null) {
            throw new Error(`npm install succeeded but package.json not found at ${pkgJsonPath}`);
        }
        const pkgInstallPath = path.join(installDir, 'node_modules', packageName);
        return {
            name: pkg.name,
            version: pkg.version,
            installPath: pkgInstallPath,
            manifest: toManifest(pkg),
        };
    }
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
    async resolve(packageName, projectId) {
        const installDir = path.join(this.baseDir, projectId);
        const pkgJsonPath = path.join(installDir, 'node_modules', packageName, 'package.json');
        const pkg = await readPackageJson(pkgJsonPath);
        if (pkg === null)
            return null;
        const pkgInstallPath = path.join(installDir, 'node_modules', packageName);
        return {
            name: pkg.name,
            version: pkg.version,
            installPath: pkgInstallPath,
            manifest: toManifest(pkg),
        };
    }
    /**
     * Discover all installed tx skill packages for a project.
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
     * (i.e., they have a `twisted` field or list "@twisted.works/tx" in their keywords).
     */
    async discover(projectId) {
        const modulesDir = path.join(this.baseDir, projectId, 'node_modules');
        let topLevelEntries;
        try {
            topLevelEntries = await readdir(modulesDir);
        }
        catch {
            // node_modules does not exist — no packages installed yet.
            return [];
        }
        // Collect all (entryName, packageDir) pairs to inspect.
        // entryName is the package name as npm knows it (e.g., "@org/pkg").
        const candidates = [];
        for (const entry of topLevelEntries) {
            if (entry.startsWith('@')) {
                // Scoped namespace directory — descend one level.
                const scopeDir = path.join(modulesDir, entry);
                let scopedEntries;
                try {
                    scopedEntries = await readdir(scopeDir);
                }
                catch {
                    continue;
                }
                for (const scopedEntry of scopedEntries) {
                    candidates.push({
                        packageName: `${entry}/${scopedEntry}`,
                        packageDir: path.join(scopeDir, scopedEntry),
                    });
                }
            }
            else {
                candidates.push({
                    packageName: entry,
                    packageDir: path.join(modulesDir, entry),
                });
            }
        }
        const results = [];
        for (const { packageName, packageDir } of candidates) {
            const pkgJsonPath = path.join(packageDir, 'package.json');
            const pkg = await readPackageJson(pkgJsonPath);
            if (pkg === null)
                continue;
            if (!isTwistedPackage(pkg))
                continue;
            results.push({
                name: pkg.name,
                version: pkg.version,
                installPath: packageDir,
                manifest: toManifest(pkg),
            });
        }
        return results;
    }
    /**
     * Remove an installed package directory.
     * No-op if the package doesn't exist.
     */
    async removePackage(packageName, projectId) {
        const pkgDir = path.join(this.baseDir, projectId, 'node_modules', packageName);
        await rm(pkgDir, { recursive: true, force: true });
    }
    /**
     * Remove a package entry from the skill manifest.
     * No-op if the manifest doesn't exist or the package isn't in it.
     */
    async removeManifestEntry(packageName, projectId) {
        const manifestPath = path.join(this.baseDir, projectId, 'skill-manifest.json');
        let content;
        try {
            const raw = await readFile(manifestPath, 'utf-8');
            content = JSON.parse(raw);
        }
        catch {
            return; // No manifest — nothing to clean.
        }
        if (!(packageName in content))
            return;
        delete content[packageName];
        await writeFile(manifestPath, JSON.stringify(content, null, 2), 'utf-8');
    }
}
// ── Factory ───────────────────────────────────────────────────────────────
/**
 * Create a resolver using ~/.twisted/projects/ as the base directory.
 * This is the standard per-user install location for project-scoped packages.
 */
export function createNpmResolver() {
    const baseDir = path.join(os.homedir(), '.twisted', 'projects');
    return new NpmPackageResolver(baseDir);
}
//# sourceMappingURL=resolver.js.map