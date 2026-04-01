// src/cli/args.ts
import type { ParsedCommand, GlobalFlags, TwistedSubcommand } from "../types/commands.js";

export function parseArgs(argv: string[]): ParsedCommand {
  const flags: GlobalFlags & { version?: boolean; help?: boolean } = {
    agent: false,
    yolo: false,
  };

  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === "-a" || arg === "--agent") { flags.agent = true; i++; continue; }
    if (arg === "-y" || arg === "--yolo") { flags.yolo = true; i++; continue; }
    if (arg === "-v" || arg === "--version") { flags.version = true; i++; continue; }
    if (arg === "-h" || arg === "--help") { flags.help = true; i++; continue; }
    if ((arg === "-e" || arg === "--epic") && argv[i + 1]) {
      flags.epic = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--note" || arg === "--decide" || arg === "--defer" || arg === "--discover" || arg === "--blocker" || arg === "--retro") {
      positional.push(arg);
      i++;
      continue;
    }
    if ((arg === "--reason" || arg === "--impact" || arg === "--group") && argv[i + 1]) {
      positional.push(arg, argv[i + 1]!);
      i += 2;
      continue;
    }
    if (arg === "--done" || arg === "--undone") {
      positional.push(arg);
      i++;
      continue;
    }
    if (arg === "--number" && argv[i + 1]) {
      positional.push(arg, argv[i + 1]!);
      i += 2;
      continue;
    }
    positional.push(arg);
    i++;
  }

  if (flags.version || flags.help || positional.length === 0) {
    return { subcommand: undefined, params: {}, flags, raw_args: argv.join(" ") };
  }

  const subcommand = positional[0] as TwistedSubcommand;
  const rest = positional.slice(1);

  const params = parseSubcommandParams(subcommand, rest, flags);
  return { subcommand, params, flags, raw_args: argv.join(" ") };
}

function epic(rest: string[], flags: GlobalFlags & { version?: boolean; help?: boolean }): string | undefined {
  return rest.find((r) => !r.startsWith("-")) ?? flags.epic;
}

function parseSubcommandParams(sub: string, rest: string[], flags: GlobalFlags & { version?: boolean; help?: boolean }): Record<string, unknown> {
  switch (sub) {
    case "open": {
      const typeIdx = rest.indexOf("--type");
      const type = typeIdx >= 0 ? rest[typeIdx + 1] : undefined;
      const name = rest.find((r) => !r.startsWith("-"));
      const params: Record<string, unknown> = { epic: name };
      if (type) params.type = type;
      return params;
    }

    case "ready":
    case "resume":
    case "close":
    case "status":
    case "artifacts":
      return { epic: epic(rest, flags) };

    case "next":
    case "research":
    case "scope":
    case "plan":
    case "build":
      return { epic: epic(rest, flags) };

    case "archive": {
      const reasonIdx = rest.indexOf("--reason");
      const reason = reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined;
      return { epic: epic(rest, flags), reason };
    }

    case "estimate": {
      const sizeIdx = rest.indexOf("--size");
      const rationaleIdx = rest.indexOf("--rationale");
      const timeboxIdx = rest.indexOf("--timebox");
      const confidenceIdx = rest.indexOf("--confidence");
      return {
        epic: epic(rest, flags),
        size: sizeIdx >= 0 ? rest[sizeIdx + 1] : undefined,
        rationale: rationaleIdx >= 0 ? rest[rationaleIdx + 1] : undefined,
        timebox: timeboxIdx >= 0 ? rest[timeboxIdx + 1] : undefined,
        confidence: confidenceIdx >= 0 ? parseInt(rest[confidenceIdx + 1]!, 10) : undefined,
      };
    }

    case "backlog": {
      const action = rest[0];
      if (action === "promote") return { action: "promote", id: rest[1] };
      return { action };
    }

    case "promote": {
      const typeIdx = rest.indexOf("--type");
      return { epic: epic(rest, flags), type: typeIdx >= 0 ? rest[typeIdx + 1] : undefined };
    }

    case "stories": {
      const e = epic(rest, flags);
      const action = rest.includes("add") ? "add"
        : rest.includes("done") ? "done"
        : rest.includes("show") ? "show"
        : undefined;
      const id = action && rest.find((r) => r.startsWith("S-"));
      const summaryIdx = action === "add" ? rest.indexOf("add") + 1 : -1;
      return { epic: e, action, id, summary: summaryIdx >= 0 ? rest[summaryIdx] : undefined };
    }

    case "config":
      return { section: rest[0], subsection: rest[1] };

    case "pickup":
    case "handoff":
      return { name: rest[0] };

    case "session":
      return { action: rest[0], name: rest[1] };

    case "write":
    case "read": {
      const type = rest[0];
      const e = rest.find((r, idx) => idx > 0 && !r.startsWith("-")) ?? flags.epic;
      const numberIdx = rest.indexOf("--number");
      return { type, epic: e, number: numberIdx >= 0 ? parseInt(rest[numberIdx + 1]!, 10) : undefined };
    }

    case "tasks": {
      const action = rest[0];
      if (!action || !["add", "update", "assign", "show"].includes(action)) {
        return { epic: epic(rest, flags) };
      }
      const params: Record<string, unknown> = { action };
      if (action === "add") {
        params.summary = rest[1];
      } else {
        params.id = rest[1];
      }
      if (rest.includes("--done")) params.done = true;
      else if (rest.includes("--undone")) params.done = false;
      const groupIdx = rest.indexOf("--group");
      if (groupIdx >= 0) params.group = rest[groupIdx + 1];
      return params;
    }

    case "note": {
      const summary = rest.find((r) => !r.startsWith("-"));
      const params: Record<string, unknown> = { summary };
      if (rest.includes("--decide")) params.type = "decision";
      else if (rest.includes("--defer")) params.type = "deferral";
      else if (rest.includes("--discover")) params.type = "discovery";
      else if (rest.includes("--blocker")) params.type = "blocker";
      else if (rest.includes("--retro")) params.type = "retro";
      else params.type = "note";
      const reasonIdx = rest.indexOf("--reason");
      if (reasonIdx >= 0) params.reason = rest[reasonIdx + 1];
      const impactIdx = rest.indexOf("--impact");
      if (impactIdx >= 0) params.impact = rest[impactIdx + 1];
      return params;
    }

    case "notes": {
      const params: Record<string, unknown> = { epic: epic(rest, flags) };
      const typeIdx = rest.indexOf("--type");
      if (typeIdx >= 0) params.type = rest[typeIdx + 1];
      const stepIdx = rest.indexOf("--step");
      if (stepIdx >= 0) params.step = rest[stepIdx + 1];
      return params;
    }

    default:
      return {};
  }
}
