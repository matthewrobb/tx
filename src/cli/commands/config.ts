// src/cli/commands/config.ts
import { Command } from "commander";
import type { CliContext } from "../context.js";

export function registerConfigCommands(program: Command, ctx: CliContext): void {
  const { config, respond } = ctx;

  // ─── config ────────────────────────────────────────────────────────────────

  program
    .command("config")
    .description("Show config")
    .argument("[section]", "config section")
    .argument("[subsection]", "config subsection")
    .action(() => {
      respond({ status: "ok", command: "config", config: config as unknown as Record<string, unknown>, display: JSON.stringify(config, null, 2) });
    });
}
