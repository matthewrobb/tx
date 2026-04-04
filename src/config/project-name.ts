// src/config/project-name.ts — Resolve the project name for user-dir paths.
//
// Resolution order:
//   1. `name` field in .twisted/settings.json
//   2. Parent directory name of .twisted/settings.json
//
// engine-v5 will add .twisted.json as a fallback config location.

import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/**
 * Resolve the project name from settings or directory name.
 *
 * Used to derive the user-dir path: ~/.twisted/projects/{name}/
 */
export function resolveProjectName(cwd?: string): string {
  const dir = resolve(cwd ?? process.cwd());
  const settingsPath = join(dir, '.twisted', 'settings.json');

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    if (typeof parsed.name === 'string' && parsed.name.trim()) {
      return sanitize(parsed.name.trim());
    }
  } catch {
    // settings.json doesn't exist or isn't valid JSON — fall through
  }

  return sanitize(basename(dir));
}

/**
 * Sanitize a project name for use in filesystem paths.
 * Lowercase, alphanumeric + hyphens only.
 */
function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

/**
 * Returns the absolute path to the project's user-dir.
 */
export function resolveProjectDir(cwd?: string): string {
  const name = resolveProjectName(cwd);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return join(home, '.twisted', 'projects', name);
}
