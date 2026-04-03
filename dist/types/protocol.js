// src/types/protocol.ts — Daemon/CLI/agent protocol types for v4.
//
// Three layers:
//   1. DaemonRequest  — CLI sends to the daemon over a Unix socket
//   2. DaemonResponse — daemon replies to the CLI
//   3. AgentResponse  — what the /tx skill system returns to the orchestrating agent
//
// The daemon owns PGLite and all state; the CLI is a thin socket client.
export {};
//# sourceMappingURL=protocol.js.map