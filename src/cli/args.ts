// src/cli/args.ts
import type { ParsedCommand, GlobalFlags, TwistedSubcommand } from "../../types/commands.js";
import type { NoteType } from "../../types/notes.js";

export function parseArgs(argv: string[]): ParsedCommand {
  const flags: GlobalFlags & { version?: boolean; help?: boolean } = {
    agent: false,
    yolo: false,
  };

  // Extract flags
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === "-a" || arg === "--agent") { flags.agent = true; i++; continue; }
    if (arg === "-y" || arg === "--yolo") { flags.yolo = true; i++; continue; }
    if (arg === "-v" || arg === "--version") { flags.version = true; i++; continue; }
    if (arg === "-h" || arg === "--help") { flags.help = true; i++; continue; }
    if ((arg === "-o" || arg === "--objective") && argv[i + 1]) {
      flags.objective = argv[i + 1];
      i += 2;
      continue;
    }
    if ((arg === "-e" || arg === "--epic") && argv[i + 1]) {
      flags.epic = argv[i + 1];
      i += 2;
      continue;
    }
    // Note type flags
    if (arg === "--note" || arg === "--decide" || arg === "--defer" || arg === "--discover" || arg === "--blocker") {
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

function parseSubcommandParams(sub: string, rest: string[], flags: GlobalFlags & { version?: boolean; help?: boolean }): Record<string, unknown> {
  switch (sub) {
    case "open": {
      const typeIdx = rest.indexOf("--type");
      const type = typeIdx >= 0 ? rest[typeIdx + 1] : undefined;
      const epicName = rest.find((r) => !r.startsWith("-"));
      const params: Record<string, unknown> = { objective: epicName };
      if (type) params.type = type;
      return params;
    }

    case "ready":
      return { epic: rest[0] ?? flags.epic };

    case "archive": {
      const reasonIdx = rest.indexOf("--reason");
      const reason = reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined;
      return { epic: rest.find((r) => !r.startsWith("-")) ?? flags.epic, reason };
    }

    case "estimate": {
      const epic = rest.find((r) => !r.startsWith("-")) ?? flags.epic ?? flags.objective;
      const sizeIdx = rest.indexOf("--size");
      const size = sizeIdx >= 0 ? rest[sizeIdx + 1] : undefined;
      const rationaleIdx = rest.indexOf("--rationale");
      const rationale = rationaleIdx >= 0 ? rest[rationaleIdx + 1] : undefined;
      const timeboxIdx = rest.indexOf("--timebox");
      const timebox = timeboxIdx >= 0 ? rest[timeboxIdx + 1] : undefined;
      const confidenceIdx = rest.indexOf("--confidence");
      const confidence = confidenceIdx >= 0 ? parseInt(rest[confidenceIdx + 1]!, 10) : undefined;
      return { epic, size, rationale, timebox, confidence };
    }

    case "backlog": {
      const action = rest[0];
      if (action === "promote") {
        return { action: "promote", id: rest[1] };
      }
      return { action };
    }

    case "promote": {
      const epic = rest.find((r) => !r.startsWith("-")) ?? flags.epic ?? flags.objective;
      const typeIdx = rest.indexOf("--type");
      const type = typeIdx >= 0 ? rest[typeIdx + 1] : undefined;
      return { epic, type };
    }

    case "stories": {
      const epic = rest.find((r) => !r.startsWith("-")) ?? flags.epic ?? flags.objective;
      const action = rest.includes("add") ? "add"
        : rest.includes("done") ? "done"
        : rest.includes("show") ? "show"
        : undefined;
      const id = action && rest.find((r) => r.startsWith("S-"));
      const summaryIdx = action === "add" ? rest.indexOf("add") + 1 : -1;
      const summary = summaryIdx >= 0 ? rest[summaryIdx] : undefined;
      return { epic, action, id, summary };
    }

    case "close":
    case "next":
    case "resume":
    case "research":
    case "scope":
    case "plan":
    case "build":
    case "status":
      return { objective: rest.find((r) => !r.startsWith("-")) };

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
      const objective = rest.find((r, i) => i > 0 && !r.startsWith("-")) ?? flags.objective;
      const numberIdx = rest.indexOf("--number");
      const number = numberIdx >= 0 ? parseInt(rest[numberIdx + 1]!, 10) : undefined;
      return { type, objective, number };
    }

    case "artifacts":
      return { objective: rest[0] };

    case "tasks": {
      const action = rest[0];
      if (!action || !["add", "update", "assign", "show"].includes(action)) {
        return { objective: rest[0] };
      }
      const params: Record<string, unknown> = { action };
      if (action === "add") {
        params.summary = rest[1];
      } else {
        params.id = parseInt(rest[1]!, 10);
      }
      if (rest.includes("--done")) params.done = true;
      else if (rest.includes("--undone")) params.done = false;
      const groupIdx = rest.indexOf("--group");
      if (groupIdx >= 0) params.group = parseInt(rest[groupIdx + 1]!, 10);
      return params;
    }

    case "note": {
      const summary = rest.find((r) => !r.startsWith("-"));
      const params: Record<string, unknown> = { summary };
      if (rest.includes("--decide")) params.type = "decision";
      else if (rest.includes("--defer")) params.type = "deferral";
      else if (rest.includes("--discover")) params.type = "discovery";
      else if (rest.includes("--blocker")) params.type = "blocker";
      else if (rest.includes("--note")) params.type = "note";
      const reasonIdx = rest.indexOf("--reason");
      if (reasonIdx >= 0) params.reason = rest[reasonIdx + 1];
      const impactIdx = rest.indexOf("--impact");
      if (impactIdx >= 0) params.impact = rest[impactIdx + 1];
      return params;
    }

    case "notes": {
      const params: Record<string, unknown> = {};
      const objective = rest.find((r) => !r.startsWith("-"));
      if (objective) params.objective = objective;
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
