#!/usr/bin/env node
// src/daemon/daemon-entry.ts — Standalone entry point for the tx daemon process.
//
// Spawned by SockDaemonClient when no daemon is running. Receives configuration
// via environment variables, sets CWD to the project's user-dir so sock-daemon's
// paths resolve correctly, then starts the TxDaemonServer.
//
// Environment variables:
//   TX_PROJECT_DIR  — absolute path to ~/.twisted/projects/{name}/ (becomes CWD)
//   TX_BASE_PATH    — absolute path to {project}/.twisted/ (for markdown projections)
import { TxDaemonServer } from './tx-server.js';
import { join } from 'node:path';
const projectDir = process.env.TX_PROJECT_DIR;
const basePath = process.env.TX_BASE_PATH;
if (!projectDir || !basePath) {
    console.error('daemon-entry: TX_PROJECT_DIR and TX_BASE_PATH must be set');
    process.exit(1);
}
// sock-daemon derives socket path from CWD — set it to the project's user-dir.
process.chdir(projectDir);
const dataDir = join(projectDir, 'data');
const server = new TxDaemonServer({ basePath, dataDir });
await server.listen();
//# sourceMappingURL=daemon-entry.js.map