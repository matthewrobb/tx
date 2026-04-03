import type { DaemonResponse } from '../types/protocol.js';
/** Set the command name used in AgentResponse.command for the current invocation. */
export declare function setCurrentCommand(name: string): void;
/**
 * Format a DaemonResponse for human-readable output.
 *
 * The formatted string is returned, not printed, so callers can pipe it or
 * include it in an AgentResponse.display field.
 */
export declare function formatResponse(res: DaemonResponse, agentMode: boolean): string;
/**
 * Print the formatted response to stdout.
 *
 * In agent mode the full AgentResponse JSON is printed.
 * In human mode the plain display text is printed.
 */
export declare function printResponse(res: DaemonResponse, agentMode: boolean): void;
/**
 * Print an error message and exit with code 1.
 *
 * In agent mode the error is wrapped in an AgentResponse so the caller always
 * receives valid JSON.
 *
 * Declared as `never` because it always exits — this propagates into callers
 * and avoids requiring explicit `return` after a `printError()` call.
 */
export declare function printError(message: string, agentMode: boolean): never;
//# sourceMappingURL=output.d.ts.map