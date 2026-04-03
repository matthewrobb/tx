// src/cli/__tests__/config-merge.test.ts
//
// TDD for config merge — deep-merges JSON into .twisted/settings.json.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { mergeIntoSettings } from '../commands/config-merge.js';

let projectDir: string;

beforeEach(async () => {
  projectDir = join(tmpdir(), `tw-config-test-${randomUUID()}`);
  await mkdir(join(projectDir, '.twisted'), { recursive: true });
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('mergeIntoSettings', () => {
  test('creates settings.json when it does not exist', async () => {
    await mergeIntoSettings(projectDir, {
      step_skills: { build: '@community/skills/tdd' },
    });

    const content = JSON.parse(
      await readFile(join(projectDir, '.twisted', 'settings.json'), 'utf-8'),
    );
    expect(content.step_skills.build).toBe('@community/skills/tdd');
  });

  test('merges into existing settings without clobbering', async () => {
    await writeFile(
      join(projectDir, '.twisted', 'settings.json'),
      JSON.stringify({
        "$schema": "../schemas/settings.schema.json",
        context_skills: ["my-nav-skill"],
      }),
      'utf-8',
    );

    await mergeIntoSettings(projectDir, {
      step_skills: { scope: '@community/skills/write-a-prd' },
    });

    const content = JSON.parse(
      await readFile(join(projectDir, '.twisted', 'settings.json'), 'utf-8'),
    );
    // Existing fields preserved.
    expect(content.context_skills).toEqual(["my-nav-skill"]);
    expect(content["$schema"]).toBe("../schemas/settings.schema.json");
    // New fields added.
    expect(content.step_skills.scope).toBe('@community/skills/write-a-prd');
  });

  test('deep-merges nested objects', async () => {
    await writeFile(
      join(projectDir, '.twisted', 'settings.json'),
      JSON.stringify({
        step_skills: { build: '@community/skills/tdd' },
        step_review_skills: { plan: '@community/skills/grill-me' },
      }),
      'utf-8',
    );

    await mergeIntoSettings(projectDir, {
      step_skills: { scope: '@community/skills/write-a-prd' },
    });

    const content = JSON.parse(
      await readFile(join(projectDir, '.twisted', 'settings.json'), 'utf-8'),
    );
    // Existing step_skills preserved.
    expect(content.step_skills.build).toBe('@community/skills/tdd');
    // New step_skills merged in.
    expect(content.step_skills.scope).toBe('@community/skills/write-a-prd');
    // Unrelated fields untouched.
    expect(content.step_review_skills.plan).toBe('@community/skills/grill-me');
  });
});
