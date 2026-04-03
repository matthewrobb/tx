// src/types/protocol.ts — Daemon/CLI/agent protocol types for v4.
//
// Three layers:
//   1. DaemonRequest  — CLI sends to the daemon over a Unix socket
//   2. DaemonResponse — daemon replies to the CLI
//   3. AgentResponse  — what the /tx skill system returns to the orchestrating agent
//
// The daemon owns PGLite and all state; the CLI is a thin socket client.

import type { IssueType, IssueStatus } from './issue.js';
import type { TwistedConfig } from './config.js';

// ---------------------------------------------------------------------------
// Daemon request — discriminated union on `command`
// ---------------------------------------------------------------------------

export type NoteTag = 'decide' | 'defer' | 'discover' | 'blocker' | 'retro';

export type DaemonRequest =
  | { command: 'next'; issue_slug: string }
  | { command: 'status'; issue_slug?: string }
  | { command: 'write'; type: string; content: string; issue_slug: string }
  | { command: 'read'; type: string; issue_slug: string }
  | { command: 'note'; summary: string; tags: NoteTag[]; issue_slug?: string }
  | { command: 'open'; slug: string; type: IssueType; title?: string }
  | { command: 'close'; issue_slug: string }
  | { command: 'pickup'; name?: string }
  | { command: 'handoff' }
  | { command: 'checkpoint'; summary: string }
  // Cycle commands — group related issues into a named iteration / sprint.
  | { command: 'cycle_start'; slug: string; title: string; description?: string }
  | { command: 'cycle_pull'; issue_slugs: string[] }
  | { command: 'cycle_close'; summary: string };

// ---------------------------------------------------------------------------
// Daemon response — discriminated union on `status`
// ---------------------------------------------------------------------------

/**
 * DaemonResponse uses `unknown` for the success data field intentionally:
 * the shape varies by command, and callers narrow it at the usage site.
 * This avoids a sprawling generic or an `any` escape hatch.
 */
export type DaemonResponse =
  | { status: 'ok'; data: unknown }
  | { status: 'error'; message: string; code?: string }
  | { status: 'paused'; prompt: AgentAction };

// ---------------------------------------------------------------------------
// Agent protocol — what /tx skill commands return to Claude
// ---------------------------------------------------------------------------

/** Lightweight status view of an issue — cheaper than full Issue. */
export interface IssueState {
  /** Issue slug. */
  issue: string;
  type: IssueType;
  workflow_id: string;
  step: string;
  status: IssueStatus;
  tasks_done: number;
  /** null if tasks haven't been decomposed yet. */
  tasks_total: number | null;
  /** ISO 8601. */
  created: string;
  /** ISO 8601. */
  updated: string;
}

export interface ActiveSession {
  number: number;
  name: string | null;
  /** The workflow step that was active when the session started. */
  step_started: string;
  /** ISO 8601 — session start time. */
  started: string;
  /** Human-readable action summaries logged during this session. */
  actions: string[];
}

export interface PreviousSession {
  number: number;
  name: string;
  /** Path to the saved session summary file. */
  file: string;
}

export interface SessionData {
  active: ActiveSession | null;
  previous: PreviousSession | null;
}

export interface AgentResponse {
  status: 'ok' | 'error' | 'paused' | 'handoff';
  command: string;
  action?: AgentAction;

  /** Human-readable display text for the CLI. */
  display?: string;

  /** Lightweight issue state snapshot. */
  issue?: IssueState;

  /** Full config (returned by `tx config`). */
  config?: TwistedConfig;

  error?: string;
  session?: SessionData;
}

// ---------------------------------------------------------------------------
// Agent actions — discriminated union on `type`
// ---------------------------------------------------------------------------

export interface AgentAssignment {
  id: string;
  /** Story identifier (e.g. "S-001"). */
  story: string;
  model: 'opus' | 'sonnet' | 'haiku';
  prompt: string;
}

export type AgentAction =
  | { type: 'invoke_skill'; skill: string; prompt?: string }
  | { type: 'confirm'; message: string; next_command: string }
  | { type: 'done' }
  | { type: 'prompt_user'; prompt: string; categories?: string[] }
  | { type: 'run_agents'; agents: AgentAssignment[] }
  | { type: 'install_cli'; instructions: string };
