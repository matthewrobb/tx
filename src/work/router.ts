/**
 * Command routing — parse subcommands and dispatch to the correct handler.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ObjectiveState } from "../../types/state.js";
import type { ParsedCommand, TwistedSubcommand } from "../../types/commands.js";
import { resolveConfig } from "../config/resolve.js";
import { nextStep, getEffectiveSteps, createInitialState } from "../state/machine.js";
import { shouldPause, getPhaseSettings } from "../pipeline/routing.js";

/**
 * Parse user input into a structured command.
 *
 * Examples:
 *   /twisted-work                         → { subcommand: undefined }
 *   /twisted-work status my-feature       → { subcommand: "status", params: { objective: "my-feature" } }
 *   /twisted-work next --yolo             → { subcommand: "next", flags: { yolo: true } }
 *   /twisted-work config pipeline research → { subcommand: "config", params: { section: "pipeline", subsection: "research" } }
 */
export function parseCommand(rawArgs: string): ParsedCommand {
  const args = rawArgs.trim().split(/\s+/);
  const flags = { yolo: args.includes("--yolo") };
  const filtered = args.filter(a => a !== "--yolo");

  const subcommand = filtered[0] as TwistedSubcommand | undefined;
  const rest = filtered.slice(1);

  switch (subcommand) {
    case "status":
      return { subcommand, params: { objective: rest[0] }, flags, raw_args: rawArgs };
    case "next":
      return { subcommand, params: { objective: rest[0] }, flags, raw_args: rawArgs };
    case "resume":
      return { subcommand, params: { objective: rest[0]! }, flags, raw_args: rawArgs };
    case "config":
      return { subcommand, params: { section: rest[0], subsection: rest[1] }, flags, raw_args: rawArgs };
    default:
      return { subcommand, params: {}, flags, raw_args: rawArgs };
  }
}

/**
 * Route a parsed command to the correct handler.
 *
 * Subcommand mapping:
 *   init      → setup .twisted/, detect tools, select presets, write $schema
 *   status    → scan lanes, read state.md frontmatter, display
 *   next      → find active objective, advance to next step
 *   resume    → find named objective, resume at current step
 *   scope     → load twisted-scope sub-skill
 *   decompose → load twisted-decompose sub-skill
 *   execute   → load twisted-execute sub-skill
 *   review    → delegate to pipeline.code_review.provider
 *   ship      → delegate to pipeline.ship.provider
 *   config    → show/edit config with hierarchical drill-down
 *   (none)    → interactive mode: scan, show status, ask resume or new
 */
export function routeCommand(
  command: ParsedCommand,
  config: TwistedConfig,
): void {
  switch (command.subcommand) {
    case "init":
      executeInit(config, command.flags.yolo);
      return;
    case "status":
      executeStatus(config, command.params);
      return;
    case "next":
      executeNext(config, command.params, command.flags.yolo);
      return;
    case "resume":
      executeResume(config, command.params, command.flags.yolo);
      return;
    case "scope":
    case "decompose":
    case "execute":
    case "review":
    case "ship":
      executeStep(config, command.subcommand, command.flags.yolo);
      return;
    case "config":
      executeConfig(config, command.params);
      return;
    default:
      executeInteractive(config, command.flags.yolo);
      return;
  }
}
