// src/adapters/socket/paths.ts — platform-aware socket path resolution.
//
// Socket paths are keyed by project ID to support multiple concurrent projects.
// The project ID is derived from the last path component (for readability) plus
// a short hash of the full path (to avoid collisions between same-named dirs).
//
// Platform format:
//   Windows: \\.\pipe\twisted-{projectId}
//   Unix:    {homedir}/.twisted/{projectId}.sock  (falls back to /tmp on error)

import { createHash } from 'crypto';
import { homedir, tmpdir, platform } from 'os';
import { join, basename } from 'path';
import { resolve } from 'path';

// ── Project ID ──────────────────────────────────────────────────────────────

/**
 * Returns a project ID derived from the given directory path.
 *
 * Format: `{last-component}-{6-char-hash}`
 *
 * The slug uses only lowercase alphanumerics and hyphens so it is safe in both
 * Unix socket paths and Windows pipe names. The hash prevents collisions when
 * two projects share the same directory name (e.g. `app` in different repos).
 *
 * @example
 *   getProjectId('/home/user/projects/my-app')  → 'my-app-a3f2b1'
 *   getProjectId('C:\\Users\\user\\my-app')     → 'my-app-a3f2b1'
 */
export function getProjectId(cwd?: string): string {
  const dir = resolve(cwd ?? process.cwd());
  const last = basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
  const hash = createHash('sha1').update(dir).digest('hex').slice(0, 6);
  return `${last}-${hash}`;
}

// ── Socket path ─────────────────────────────────────────────────────────────

/**
 * Returns the socket path for the given project ID.
 *
 * Windows uses a named pipe (\\.\pipe\twisted-{projectId}) because Unix domain
 * sockets are not supported on Windows outside of WSL. Named pipes are the
 * idiomatic IPC mechanism — Node's `net` module handles both transparently.
 *
 * Unix uses a socket file in ~/.twisted/ rather than /tmp/ so it survives
 * across system temporary file cleanups. Falls back to /tmp/ if homedir() is
 * unavailable (e.g. certain CI environments).
 */
export function getSocketPath(projectId: string): string {
  if (platform() === 'win32') {
    // Named pipe — backslashes are required; forward slashes are NOT accepted
    return `\\\\.\\pipe\\twisted-${projectId}`;
  }

  // Unix domain socket
  let dir: string;
  try {
    dir = join(homedir(), '.twisted');
  } catch {
    // homedir() can throw if HOME is not set (unusual but possible in CI)
    dir = tmpdir();
  }

  return join(dir, `${projectId}.sock`);
}
