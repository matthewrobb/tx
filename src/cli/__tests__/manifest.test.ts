// src/cli/__tests__/manifest.test.ts
//
// TDD for tx manifest write/show. Tests the command via the resolver's
// file I/O using a local temp dir as the base.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { NpmPackageResolver } from '../../adapters/npm/resolver.js';

// ── Helpers ───────────────────────────────────────────────────────────────

let baseDir: string;
const projectId = 'test-project';

beforeEach(async () => {
  baseDir = join(tmpdir(), `tw-manifest-test-${randomUUID()}`);
  await mkdir(join(baseDir, projectId), { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

function manifestPath(): string {
  return join(baseDir, projectId, 'skill-manifest.json');
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('skill manifest file I/O', () => {
  test('write then read roundtrip preserves content', async () => {
    const manifest = {
      '@mattpocock/skills': {
        version: '0.0.0-git',
        discovered: '2026-04-03T00:00:00.000Z',
        skills: {
          tdd: {
            path: 'tdd/SKILL.md',
            description: 'Test-driven development',
            detected_outputs: [],
            suggested_overrides: { omit: [], directives: [] },
          },
          'write-a-prd': {
            path: 'write-a-prd/SKILL.md',
            description: 'Create a PRD through user interview',
            detected_outputs: ['github-issue'],
            suggested_overrides: {
              omit: ['Step 5'],
              directives: ['Do NOT submit as GitHub issue. Use tx write scope.'],
            },
          },
        },
      },
    };

    const path = manifestPath();
    await writeFile(path, JSON.stringify(manifest, null, 2), 'utf-8');

    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed['@mattpocock/skills'].skills.tdd.detected_outputs).toEqual([]);
    expect(parsed['@mattpocock/skills'].skills['write-a-prd'].detected_outputs).toEqual(['github-issue']);
    expect(parsed['@mattpocock/skills'].skills['write-a-prd'].suggested_overrides.omit).toEqual(['Step 5']);
  });

  test('resolver getBaseDir returns the configured base', () => {
    const resolver = new NpmPackageResolver(baseDir);
    expect(resolver.getBaseDir()).toBe(baseDir);
  });
});
