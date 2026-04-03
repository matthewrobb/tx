/**
 * PackageResolverPort — npm-based skill and persona package management.
 *
 * Skills and personas are distributed as npm packages. This port handles
 * installation, resolution, and discovery scoped to individual projects.
 *
 * Packages are installed to ~/.twisted/projects/{projectId}/node_modules/
 * to keep project-level dependencies isolated from each other and from the
 * global twisted-workflow installation.
 */

import type { WorkflowConfig } from '../types/config.js';

// ── Package types ──────────────────────────────────────────────

/** The parsed package.json of a twisted-workflow skill/persona package. */
export interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  /** Skill identifiers exported by this package. */
  readonly skills?: readonly string[];
  /** Persona identifiers exported by this package. */
  readonly personas?: readonly string[];
  /** Relative path to the package's main entry file (e.g., skill definition). */
  readonly entry?: string;
  /**
   * Workflow definitions contributed by this package.
   * Mapped from the `twisted.workflows` field in the package's package.json.
   * These are appended to the base config's workflow list during mergeWithPackage.
   */
  readonly workflows?: readonly WorkflowConfig[];
}

/** A fully resolved, installed package with its location and manifest. */
export interface ResolvedPackage {
  readonly name: string;
  readonly version: string;
  /** Absolute path to the installed package directory. */
  readonly installPath: string;
  readonly manifest: PackageManifest;
}

// ── Package resolver port ──────────────────────────────────────

export interface PackageResolverPort {
  /**
   * Install a package to the project's package directory.
   * Runs `npm install` scoped to ~/.twisted/projects/{projectId}/.
   *
   * @param packageName - npm package name (e.g., "@twisted/skill-review")
   * @param projectId - Project identifier for scoped installation
   * @returns The resolved package after installation
   */
  install(packageName: string, projectId: string): Promise<ResolvedPackage>;

  /**
   * Resolve an already-installed package by name.
   * Returns null if the package is not installed for this project.
   *
   * @param packageName - npm package name to look up
   * @param projectId - Project identifier for scoped resolution
   */
  resolve(
    packageName: string,
    projectId: string,
  ): Promise<ResolvedPackage | null>;

  /**
   * Discover all installed twisted-workflow packages for a project.
   * Scans the project's node_modules for packages with skill/persona manifests.
   *
   * @param projectId - Project identifier to scan
   */
  discover(projectId: string): Promise<ResolvedPackage[]>;
}
