import { join } from "path";
import { readActiveSession, writeActiveSession, deleteActiveSession, listSessions, writeArtifact, ensureDir, } from "../fs.js";
import { readFileSync, existsSync } from "fs";
/**
 * Generate a session summary markdown from the action log.
 */
function generateSummary(sess, epicName) {
    const lines = [
        `# Session #${sess.number}${sess.name ? ` — ${sess.name}` : ""}`,
        "",
        `**Epic:** ${epicName}`,
        `**Started:** ${sess.started}`,
        `**Ended:** ${sess.ended ?? new Date().toISOString()}`,
        `**Step at start:** ${sess.step_started}`,
        "",
    ];
    if (sess.actions.length === 0) {
        lines.push("_No actions logged._");
    }
    else {
        lines.push("## Actions", "");
        for (const a of sess.actions) {
            lines.push(`- **${a.type}**: ${a.summary}`);
        }
    }
    lines.push("");
    return lines.join("\n");
}
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
        // If a session already exists, just report it
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
        // Find previous session for context
        const sessions = listSessions(active.dir);
        const previous = sessions.length > 0
            ? sessions.sort((a, b) => b.number - a.number)[0] ?? null
            : null;
        // Read previous session content for handoff context
        let previousContent = null;
        if (previous) {
            const prevPath = join(active.dir, "sessions", previous.file);
            if (existsSync(prevPath)) {
                previousContent = readFileSync(prevPath, "utf-8");
            }
        }
        // Create new session
        const nextNumber = sessions.length > 0
            ? Math.max(...sessions.map((s) => s.number)) + 1
            : 1;
        const name = nameArg ?? null;
        const sess = {
            number: nextNumber,
            name,
            step_started: active.state.step,
            started: new Date().toISOString(),
            actions: [],
        };
        writeActiveSession(active.dir, sess);
        const displayLines = [
            `Session #${nextNumber} started${name ? ` (${name})` : ""}`,
            `Epic: ${active.epicName} | Lane: ${active.state.lane} | Step: ${active.state.step}`,
        ];
        if (previousContent) {
            displayLines.push("", "--- Previous session ---", previousContent);
        }
        respond({
            status: "ok",
            command: "pickup",
            session: { active: sess, previous },
            display: displayLines.join("\n"),
        });
    });
    // ─── handoff ───────────────────────────────────────────────────────────────
    program
        .command("handoff")
        .description("End session — generates summary and saves")
        .action(() => {
        const active = ctx.findActiveEpic();
        if (!active) {
            respond({ status: "error", command: "handoff", error: "No active epic" });
            return;
        }
        const sess = readActiveSession(active.dir);
        if (!sess) {
            respond({ status: "error", command: "handoff", error: "No active session" });
            return;
        }
        // Generate and save summary
        sess.ended = new Date().toISOString();
        const summary = generateSummary(sess, active.epicName);
        const sessName = sess.name ?? `session-${sess.number}`;
        const sessionsDir = join(active.dir, "sessions");
        ensureDir(sessionsDir);
        const filename = `${String(sess.number).padStart(3, "0")}-${sessName}.md`;
        writeArtifact(join(sessionsDir, filename), summary);
        deleteActiveSession(active.dir);
        respond({
            status: "ok",
            command: "handoff",
            display: `Session #${sess.number} closed → sessions/${filename}\n\n${summary}`,
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