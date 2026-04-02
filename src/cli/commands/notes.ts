// src/cli/commands/notes.ts
import { Command } from "commander";
import { locateEpic, readCoreState, readNotes, writeNotes } from "../fs.js";
import type { NoteType } from "../../types/index.js";
import type { CliContext } from "../context.js";

export function registerNotesCommands(program: Command, ctx: CliContext): void {
  const { root, respond } = ctx;

  // ─── note ──────────────────────────────────────────────────────────────────

  program
    .command("note")
    .description("Add a note to the active epic")
    .argument("<summary>", "note summary")
    .option("--decide", "note type: decision")
    .option("--defer", "note type: deferral")
    .option("--discover", "note type: discovery")
    .option("--blocker", "note type: blocker")
    .option("--retro", "note type: retro")
    .option("--reason <reason>", "reason")
    .option("--impact <impact>", "impact")
    .action((summary: string, opts: { decide?: boolean; defer?: boolean; discover?: boolean; blocker?: boolean; retro?: boolean; reason?: string; impact?: string }) => {
      const active = ctx.findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "note", error: "No active epic" });
        return;
      }
      let noteType: NoteType = "note";
      if (opts.decide) noteType = "decision";
      else if (opts.defer) noteType = "deferral";
      else if (opts.discover) noteType = "discovery";
      else if (opts.blocker) noteType = "blocker";
      else if (opts.retro) noteType = "retro";
      const notes = readNotes(active.dir);
      const newNote = {
        id: notes.length + 1,
        type: noteType,
        step: active.state.step,
        summary,
        ...(opts.reason ? { reason: opts.reason } : {}),
        ...(opts.impact ? { impact: opts.impact } : {}),
        created: new Date().toISOString(),
      };
      notes.push(newNote);
      writeNotes(active.dir, notes);
      ctx.ensureSession(active.dir, active.state.step);
      ctx.logAction(active.dir, { type: "note", summary: `[${noteType}] ${summary}`, timestamp: newNote.created });
      respond({ status: "ok", command: "note", display: `Note #${newNote.id}: ${summary}` });
    });

  // ─── notes ─────────────────────────────────────────────────────────────────

  program
    .command("notes")
    .description("Query notes")
    .argument("[epic]", "epic name")
    .option("--type <type>", "filter by note type")
    .option("--step <step>", "filter by step")
    .action((epicArg: string | undefined, opts: { type?: string; step?: string }) => {
      const globalEpic = program.opts().epic as string | undefined;
      const epicNameParam = epicArg ?? globalEpic;
      let active: ReturnType<typeof ctx.findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "notes", error: `Epic '${epicNameParam}' not found` });
          return;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = ctx.findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "notes", error: "No active epic" });
          return;
        }
      }
      const notes = readNotes(active.dir);
      const filterType = opts.type as NoteType | undefined;
      const filterStep = opts.step;
      const filtered = notes.filter((n) => {
        if (filterType && n.type !== filterType) return false;
        if (filterStep && n.step !== filterStep) return false;
        return true;
      });
      const display = filtered.map((n) => `#${n.id} [${n.type}] (${n.step}) ${n.summary}`).join("\n");
      respond({ status: "ok", command: "notes", display: display || "No notes." });
    });
}
