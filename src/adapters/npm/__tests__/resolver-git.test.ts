// src/adapters/npm/__tests__/resolver-git.test.ts
//
// TDD for installGit force reinstall and uninstall.
// Uses a local temp dir as baseDir — no real git or npm calls.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { NpmPackageResolver } from '../resolver.js';

// ── Helpers ───────────────────────────────────────────────────────────────

let baseDir: string;
let resolver: NpmPackageResolver;
const projectId = 'test-project';

beforeEach(async () => {
  baseDir = join(tmpdir(), `tw-resolver-test-${randomUUID()}`);
  resolver = new NpmPackageResolver(baseDir);
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

/** Simulate an installed git package by creating the directory structure. */
async function seedPackage(name: string, skills: string[]): Promise<string> {
  const pkgDir = join(baseDir, projectId, 'node_modules', name);
  await mkdir(pkgDir, { recursive: true });

  // Create skill dirs with SKILL.md
  for (const skill of skills) {
    const skillDir = join(pkgDir, skill);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), `# ${skill}\nTest content`, 'utf-8');
  }

  // Write synthetic package.json
  const pkg = {
    name,
    version: '0.0.0-git',
    keywords: ['twisted-workflow'],
    twisted: { skills },
  };
  await writeFile(join(pkgDir, 'package.json'), JSON.stringify(pkg), 'utf-8');

  return pkgDir;
}

/** Simulate a manifest with entries. */
async function seedManifest(content: Record<string, unknown>): Promise<string> {
  const manifestPath = join(baseDir, projectId, 'skill-manifest.json');
  await mkdir(join(baseDir, projectId), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(content, null, 2), 'utf-8');
  return manifestPath;
}

// ── Force reinstall ──────────────────────────────────────────────────────

describe('forceReinstall', () => {
  test('deletes existing package directory before returning', async () => {
    const pkgDir = await seedPackage('@test/skills', ['tdd', 'review']);

    // Add a marker file that should be gone after force delete.
    await writeFile(join(pkgDir, 'marker.txt'), 'should be deleted', 'utf-8');

    await resolver.removePackage('@test/skills', projectId);

    // Package dir should be gone.
    await expect(stat(pkgDir)).rejects.toThrow(/ENOENT/);
  });

  test('does not throw when package does not exist', async () => {
    await expect(
      resolver.removePackage('@nonexistent/pkg', projectId),
    ).resolves.toBeUndefined();
  });
});

// ── Uninstall ────────────────────────────────────────────────────────────

describe('uninstall', () => {
  test('removes package directory', async () => {
    const pkgDir = await seedPackage('@test/skills', ['tdd']);

    await resolver.removePackage('@test/skills', projectId);

    await expect(stat(pkgDir)).rejects.toThrow(/ENOENT/);
  });

  test('removeManifestEntry removes package from manifest file', async () => {
    const manifestPath = await seedManifest({
      '@test/skills': { version: '0.0.0-git', skills: {} },
      '@other/pkg': { version: '1.0.0', skills: {} },
    });

    await resolver.removeManifestEntry('@test/skills', projectId);

    const content = JSON.parse(await readFile(manifestPath, 'utf-8'));
    expect(content['@test/skills']).toBeUndefined();
    expect(content['@other/pkg']).toBeDefined();
  });

  test('removeManifestEntry is a no-op when manifest does not exist', async () => {
    await expect(
      resolver.removeManifestEntry('@test/skills', projectId),
    ).resolves.toBeUndefined();
  });

  test('removeManifestEntry is a no-op when package not in manifest', async () => {
    await seedManifest({ '@other/pkg': { version: '1.0.0', skills: {} } });

    await expect(
      resolver.removeManifestEntry('@test/skills', projectId),
    ).resolves.toBeUndefined();
  });
});
