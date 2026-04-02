import { join } from "path";
import { readActiveSession, writeActiveSession, deleteActiveSession, listSessions, writeArtifact, ensureDir, } from "../fs.js";
export function registerSessionCommands(program, ctx) {
    const { respond } = ctx;
    // ─── pickup ────────────────────────────────────────────────────────────────
    program
        .command("pickup")
        .description("Start a session")
        .argument("[name]", "session name")
        .action((nameArg) => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "pickup", error: "No active epic" });
            return;
        }
        const existing = readActiveSession(active.dir);
        if (existing) {
            respond({
                status: "ok",
                command: "pickup",
                session: { active: existing, previous: null },
                display: `Resuming session #${existing.number} (started ${existing.started})`,
            });
            return;
        }
        const sessions = listSessions(active.dir);
        const nextNumber = sessions.length > 0
            ? Math.max(...sessions.map((s) => s.number)) + 1
            : 1;
        const name = nameArg ?? null;
        const sess = {
            number: nextNumber,
            name,
            step_started: active.state.step,
            started: new Date().toISOString(),
            notes_added: [],
            artifacts_created: [],
            steps_advanced: [],
        };
        writeActiveSession(active.dir, sess);
        respond({
            status: "ok",
            command: "pickup",
            session: { active: sess, previous: null },
            display: `Session #${nextNumber} started${name ? ` (${name})` : ""}`,
        });
    });
    // ─── handoff ───────────────────────────────────────────────────────────────
    program
        .command("handoff")
        .description("End a session")
        .action(() => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "handoff", error: "No active epic" });
            return;
        }
        const session = readActiveSession(active.dir);
        if (!session) {
            respond({ status: "error", command: "handoff", error: "No active session" });
            return;
        }
        const ended = new Date().toISOString();
        writeActiveSession(active.dir, { ...session, ended });
        respond({
            status: "handoff",
            command: "handoff",
            session: { active: session, previous: null },
            action: {
                type: "prompt_user",
                prompt: "Write session summary, then run: tx session save",
            },
            display: `Ending session #${session.number}. Write summary and run: tx session save`,
        });
    });
    // ─── session ───────────────────────────────────────────────────────────────
    const sessionCmd = program
        .command("session")
        .description("Manage sessions");
    sessionCmd
        .command("status")
        .description("Show active session status")
        .action(() => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "session", error: "No active epic" });
            return;
        }
        const sess = readActiveSession(active.dir);
        if (sess) {
            respond({ status: "ok", command: "session", session: { active: sess, previous: null }, display: JSON.stringify(sess, null, 2) });
        }
        else {
            respond({ status: "ok", command: "session", display: "No active session." });
        }
    });
    sessionCmd
        .command("save")
        .description("Save active session (reads summary from stdin)")
        .action(async () => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "session", error: "No active epic" });
            return;
        }
        const sess = readActiveSession(active.dir);
        if (!sess) {
            respond({ status: "error", command: "session", error: "No active session to save" });
            return;
        }
        const sessName = (sess.name ?? `session-${sess.number}`);
        const content = await ctx.readStdin();
        const sessionsDir = join(active.dir, "sessions");
        ensureDir(sessionsDir);
        const filename = `${sess.number}-${sessName}.md`;
        writeArtifact(join(sessionsDir, filename), content);
        deleteActiveSession(active.dir);
        respond({ status: "ok", command: "session", display: `Session saved: sessions/${filename}` });
    });
    sessionCmd
        .command("list")
        .description("List saved sessions")
        .action(() => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "session", error: "No active epic" });
            return;
        }
        const sessions = listSessions(active.dir);
        const display = sessions.map((s) => `#${s.number} ${s.name} (${s.file})`).join("\n");
        respond({ status: "ok", command: "session", display: display || "No sessions." });
    });
}
//# sourceMappingURL=session.js.map