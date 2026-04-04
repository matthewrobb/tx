# Hotfix: Daemon Reliability

Minimum fixes to make `tx` usable on Windows (and generally more robust).

## Problem

The daemon fails to start reliably due to:
1. PGLite WASM cold start takes 5-10s on Windows; retry window is 1.5s
2. `EADDRINUSE` from stale daemon process — no PID tracking or cleanup
3. PGLite data stored in project dir (`.twisted/data/`) instead of user dir
4. Hand-rolled daemon lifecycle with no stale detection, no locking, no idle timeout

## Solution: Adopt sock-daemon properly

sock-daemon already handles everything we need:
- **Stale detection** — pings existing daemon, usurps if unresponsive
- **PID file** — writes on listen, deletes on close
- **Starting lock** — prevents duplicate daemon race conditions
- **Idle timeout** — auto-close after inactivity (default 1 hour)
- **signal-exit** — cleanup on process exit
- **Graceful usurp** — SIGTERM old daemon, take over socket
- **EADDRINUSE handling** — built-in retry + takeover logic
- **Binary message framing** — via socket-post-message (handles newlines in payloads)
- **Auto-start** — client spawns daemon on ENOENT, waits for ready

### Project name resolution

For the hotfix, project name is resolved as:
1. `name` field in `.twisted/settings.json` (if set)
2. Parent directory name of `.twisted/settings.json`

engine-v5 adds `.twisted.json` support with the full 4-step resolution.

This gives readable paths: `~/.twisted/projects/tx/` not `~/.twisted/projects/twisted-workflow-cc8a29/`.

### CWD trick for project-keyed sockets

sock-daemon derives socket paths as `.{serviceName}/daemon/socket` relative
to `process.cwd()`. We use this by setting CWD to the project's user data dir
before constructing client/server:

```
projectName = settings.name ?? basename(projectDir)
projectDir = ~/.twisted/projects/{projectName}/
process.chdir(projectDir)
```

Result: socket at `~/.twisted/projects/{projectName}/.tx/daemon/socket`
PGLite data at `~/.twisted/projects/{projectName}/data/`

This also fixes the "data in project dir" problem — everything daemon-related
lives in the user dir, not the repo.

## Changes

### 1. New: `src/daemon/tx-server.ts`
Subclass `SockDaemonServer`:
```ts
export class TxDaemonServer extends SockDaemonServer<DaemonRequest, DaemonResponse> {
  static get serviceName() { return 'tx' }
  async handle(msg: DaemonRequest): Promise<DaemonResponse> {
    // existing handler logic from server.ts
  }
}
```
- Move handler logic from current `TwistedDaemon.handleConnection()`
- PGLite init happens in constructor or lazy on first request
- `basePath` (for markdown projections) still points to `{cwd}/.twisted/`

### 2. New: `src/daemon/tx-client.ts`
Subclass `SockDaemonClient`:
```ts
export class TxDaemonClient extends SockDaemonClient<DaemonRequest, DaemonResponse> {
  static get serviceName() { return 'tx' }
  static get daemonScript() { return new URL('./daemon-entry.ts', import.meta.url) }
}
```
- Replaces `SocketTransportAdapter` for daemon communication
- `process.chdir(projectDir)` before constructing

### 3. New: `src/daemon/daemon-entry.ts`
Standalone entry point spawned by sock-daemon client:
```ts
process.chdir(projectDir) // from env var
const server = new TxDaemonServer()
await server.listen()
```
- Receives project dir via environment variable
- Sets CWD so sock-daemon paths resolve correctly

### 4. Rewrite: `src/cli/index.ts` `ensureDaemon()`
- Replace hand-rolled probe/start/retry with `TxDaemonClient.request()`
- sock-daemon handles auto-start, retry, stale cleanup automatically
- Remove `startDaemon()` call — client spawns daemon on demand

### 5. Remove: hand-rolled daemon lifecycle code
- Delete `src/adapters/socket/client.ts` (SocketTransportAdapter)
- Delete `src/adapters/socket/paths.ts` (getProjectId, getSocketPath)
- Simplify `src/daemon/server.ts` — remove net.Server binding, socket logic
- Remove `TransportPort` interface if no longer needed

### 6. Move PGLite data to user dir
- PGLite data lives at `~/.twisted/projects/{id}/data/` (inside projectDir)
- `.twisted/` in project stays for settings.json + markdown projections only
- `.twisted/data/` in project dir is no longer created

## Files touched
- `src/daemon/tx-server.ts` — new (SockDaemonServer subclass)
- `src/daemon/tx-client.ts` — new (SockDaemonClient subclass)  
- `src/daemon/daemon-entry.ts` — new (daemon spawn entry point)
- `src/cli/index.ts` — simplify ensureDaemon()
- `src/daemon/server.ts` — extract handler logic, remove socket binding
- `src/adapters/socket/client.ts` — delete
- `src/adapters/socket/paths.ts` — rewrite getProjectId to use settings.name ?? basename(cwd)
- `src/types/config.ts` — add optional `name` to TwistedSettings
- `build/schema/settings.ts` — add `name` to schema
- `src/ports/transport.ts` — possibly remove TransportPort
- `package.json` — keep sock-daemon, remove symlink-dir if unused

## Migration
- Old `.twisted/data/` dirs in existing projects become orphaned
  - Add note to CHANGELOG
  - Optionally: detect old data dir and print migration message on first run
