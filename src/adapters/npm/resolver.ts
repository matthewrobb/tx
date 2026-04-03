// src/adapters/npm/resolver.ts — NpmPackageResolver implementing PackageResolverPort.
//
// Installs and resolves npm packages scoped to individual projects.
// Packages are installed to {baseDir}/{projectId}/node_modules/ to keep
// per-project dependencies isolated from each other and from the global
// twisted-workflow installation.
//
// Integration tests (S-027) will cover install/resolve/discover. These
// methods require npm and filesystem access that cannot be meaningfully
// unit-tested without those real-world dependencies.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  PackageResolverPort,
  PackageManifest,
  ResolvedPackage,
} from '../../ports/packages.js';
import type { WorkflowConfig } from '../../types/config.js';

const execFileAsync = promisify(execFile);

// ── Raw package.json shape ────────────────────────────────────────────────

/**
 * Minimal shape of a package.json on disk. Fields beyond what we care about
 * are stripped — `Record<string, unknown>` covers the rest without leaking
 * `any` into the type system.
 */
interface RawPackageJson extends Record<string, unknown> {
  name: string;
  version: string;
  description?: string;
  main?: string;
  keywords?: string[];
  twisted?: {
    skills?: string[];
    personas?: string[];
    entry?: string;
    // Workflow definitions contributed by this package (optional).
    // Shape matches WorkflowConfig but we keep it as unknown here to avoid
    // a runtime dependency on the type system — toManifest passes it through
    // and the type is enforced at the PackageManifest boundary.
    workflows?: Array<Record<string, unknown>>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Read and JSON-parse a package.json file at the given path.
 * Returns null if the file does not exist or cannot be parsed.
 */
async function readPackageJson(pkgJsonPath: string): Promise<RawPackageJson | null> {
  try {
    const raw = await readFile(pkgJsonPath, 'utf-8');
    return JSON.parse(raw) as RawPackageJson;
  } catch {
    return null;
  }
}

/**
 * Map a raw package.json to a PackageManifest.
 */
function toManifest(pkg: RawPackageJson): PackageManifest {
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
    workflows: (pkg.twisted?.workflows as unknown as WorkflowConfig[] | undefined) ?? [],
  };
}

/**
 * Determine whether a raw package.json belongs to a twisted-workflow package.
 * A package qualifies if it has a `twisted` field OR lists "twisted-workflow"
 * in its keywords array.
 */
function isTwistedPackage(pkg: RawPackageJson): boolean {
  const hasTwistedField = 'twisted' in pkg && pkg.twisted !== undefined;
  const hasKeyword = Array.isArray(pkg.keywords) && pkg.keywords.includes('twisted-workflow');
  return hasTwistedField || hasKeyword;
}

// ── Resolver ──────────────────────────────────────────────────────────────

export class NpmPackageResolver implements PackageResolverPort {
  constructor(
    // Base directory for per-project installs; typically ~/.twisted/projects/
    private readonly baseDir: string,
  ) {}

  /**
   * Install a package to the project's package directory.
   *
   * Runs `npm install {packageName} --prefix {installDir} --save`.
   * The install directory is created if it does not already exist.
   */
  async install(packageName: string, projectId: string): Promise<ResolvedPackage> {
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
      throw new Error(
        `npm install succeeded but package.json not found at ${pkgJsonPath}`,
      );
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
  async resolve(packageName: string, projectId: string): Promise<ResolvedPackage | null> {
    const installDir = path.join(this.baseDir, projectId);
    const pkgJsonPath = path.join(installDir, 'node_modules', packageName, 'package.json');

    const pkg = await readPackageJson(pkgJsonPath);
    if (pkg === null) return null;

    const pkgInstallPath = path.join(installDir, 'node_modules', packageName);

    return {
      name: pkg.name,
      version: pkg.version,
      installPath: pkgInstallPath,
      manifest: toManifest(pkg),
    };
  }

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
  async discover(projectId: string): Promise<ResolvedPackage[]> {
    const modulesDir = path.join(this.baseDir, projectId, 'node_modules');

    let topLevelEntries: string[];
    try {
      topLevelEntries = await readdir(modulesDir);
    } catch {
      // node_modules does not exist — no packages installed yet.
      return [];
    }

    // Collect all (entryName, packageDir) pairs to inspect.
    // entryName is the package name as npm knows it (e.g., "@org/pkg").
    const candidates: Array<{ packageName: string; packageDir: string }> = [];

    for (const entry of topLevelEntries) {
      if (entry.startsWith('@')) {
        // Scoped namespace directory — descend one level.
        const scopeDir = path.join(modulesDir, entry);
        let scopedEntries: string[];
        try {
          scopedEntries = await readdir(scopeDir);
        } catch {
          continue;
        }
        for (const scopedEntry of scopedEntries) {
          candidates.push({
            packageName: `${entry}/${scopedEntry}`,
            packageDir: path.join(scopeDir, scopedEntry),
          });
        }
      } else {
        candidates.push({
          packageName: entry,
          packageDir: path.join(modulesDir, entry),
        });
      }
    }

    const results: ResolvedPackage[] = [];

    for (const { packageName, packageDir } of candidates) {
      const pkgJsonPath = path.join(packageDir, 'package.json');
      const pkg = await readPackageJson(pkgJsonPath);
      if (pkg === null) continue;
      if (!isTwistedPackage(pkg)) continue;

      results.push({
        name: pkg.name,
        version: pkg.version,
        installPath: packageDir,
        manifest: toManifest(pkg),
      });
    }

    return results;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a resolver using ~/.twisted/projects/ as the base directory.
 * This is the standard per-user install location for project-scoped packages.
 */
export function createNpmResolver(): NpmPackageResolver {
  const baseDir = path.join(os.homedir(), '.twisted', 'projects');
  return new NpmPackageResolver(baseDir);
}
