// src/cli/commands/config-merge.ts — Deep-merge JSON into .twisted/settings.json.
//
// Used by agents to write step_skills, context_skills, dependencies, etc.
// into the project config without clobbering existing settings.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { deepMerge } from '../../config/merge.js';

/**
 * Deep-merge `patch` into `.twisted/settings.json`.
 * Creates the file if it doesn't exist. Preserves all existing fields.
 */
export async function mergeIntoSettings(
  projectDir: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const settingsPath = join(projectDir, '.twisted', 'settings.json');

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File doesn't exist — start fresh.
  }

  const merged = deepMerge(existing, patch);

  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

  return merged;
}
