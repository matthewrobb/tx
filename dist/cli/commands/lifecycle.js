import { join } from "path";
import { twistedDir, ensureDir, readActiveSession, readCoreState, writeCoreState, writeNotes, writeTasks, findEpics, locateEpic, writeSettings, moveDir, } from "../fs.js";
import { writeRetro } from "../../engine/retro.js";
import { txNext } from "../../engine/next.js";
import { syncAgentSymlinks, agentsDir } from "../../agents/generate.js";
import { readFileSync, existsSync } from "fs";
export function registerLifecycleCommands(program, ctx) {
    const { root, config, respond } = ctx;
    function loadSettings() {
        const path = join(twistedDir(root), "settings.json");
        if (!existsSync(path))
            return {};
        try {
            return JSON.parse(readFileSync(path, "utf-8"));
        }
        catch {
            return {};
        }
    }
    // ─── init ──────────────────────────────────────────────────────────────────
    program
        .command("init")
        .description("Setup .twisted/")
        .action(async (_opts, cmd) => {
        void cmd;
        const twisted = twistedDir(root);
        for (const lane of ["0-backlog", "1-ready", "2-active", "3-review", "4-done", "5-archive"]) {
            ensureDir(join(twisted, lane));
        }
        ensureDir(agentsDir(root));
        try {
            const epics = findEpics(root);
            syncAgentSymlinks(root, epics);
        }
        catch {
            // Non-fatal — agent symlinks are best-effort
        }
        const currentSettings = loadSettings();
        if (!currentSettings || Object.keys(currentSettings).length === 0) {
            writeSettings(root, { $schema: "./schemas/settings.schema.json" });
        }
        respond({ status: "ok", command: "init", display: "Initialized .twisted/", config: config });
    });
    // ─── open ──────────────────────────────────────────────────────────────────
    program
        .command("open")
        .description("Create epic")
        .option("--name <name>", "epic name (kebab-case, max 36 chars)")
        .option("--type <type>", "epic type (feature|bug|chore|release|spike)")
        .option("--description <description>", "what this epic is about")
        .action((opts) => {
        const description = opts.description;
        // No description — tell the agent to gather it
        if (!description) {
            respond({
                status: "paused",
                command: "open",
                action: {
                    type: "prompt_user",
                    prompt: [
                        "Ask the user what they want to work on. Get a clear description of the objective.",
                        "",
                        "Then call back with:",
                        "  tx open --name <kebab-case-name> --description \"<description>\" [--type <type>] -a",
                        "",
                        "Rules:",
                        "  - --name: kebab-case, max 36 chars, derived from the description",
                        "  - --description: the user's description (quoted)",
                        "  - --type: infer from context — feature (default), bug, chore, spike, or release",
                    ].join("\n"),
                },
                display: "Describe what you want to work on.",
            });
            return;
        }
        if (!opts.name) {
            respond({ status: "error", command: "open", error: "Name required: tx open --name <name> --description \"...\" -a" });
            return;
        }
        const epicName = opts.name;
        const epicType = opts.type ?? "feature";
        const now = new Date().toISOString();
        const today = now.slice(0, 10);
        const dir = join(twistedDir(root), "0-backlog", epicName);
        ensureDir(dir);
        ensureDir(join(dir, "sessions"));
        const firstStep = config.lanes.find((l) => l.dir === "0-backlog")?.steps[0]?.name ?? "research";
        const state = {
            epic: epicName,
            description: description.trim(),
            type: epicType,
            lane: "0-backlog",
            step: firstStep,
            status: "active",
            tasks_done: 0,
            tasks_total: null,
            created: today,
            updated: now,
        };
        writeCoreState(dir, state);
        writeNotes(dir, []);
        writeTasks(dir, []);
        respond({ status: "ok", command: "open", epic: state, display: `Opened epic: ${epicName}\nType: ${epicType}\nDescription: ${description.trim().slice(0, 120)}\nLane: 0-backlog\nStep: ${firstStep}` });
    });
    // ─── ready ─────────────────────────────────────────────────────────────────
    program
        .command("ready")
        .description("Move epic to 1-ready")
        .argument("<epic>", "epic name")
        .action((epicName) => {
        const location = locateEpic(root, epicName);
        if (!location) {
            respond({ status: "error", command: "ready", error: `Epic not found: ${epicName}` });
            return;
        }
        if (location.lane !== "0-backlog") {
            respond({
                status: "error",
                command: "ready",
                error: `Epic "${epicName}" is in lane "${location.lane}", not "0-backlog"`,
            });
            return;
        }
        moveDir(root, epicName, "0-backlog", "1-ready");
        const newDir = join(twistedDir(root), "1-ready", epicName);
        const state = readCoreState(newDir);
        const readyFirstStep = config.lanes.find((l) => l.dir === "1-ready")?.steps[0]?.name ?? "plan";
        state.lane = "1-ready";
        state.step = readyFirstStep;
        state.updated = new Date().toISOString();
        writeCoreState(newDir, state);
        respond({
            status: "ok",
            command: "ready",
            display: `Epic "${epicName}" moved to 1-ready`,
            epic: state,
        });
    });
    // ─── archive ───────────────────────────────────────────────────────────────
    program
        .command("archive")
        .description("Move epic to 5-archive")
        .argument("<epic>", "epic name")
        .option("--reason <reason>", "reason for archiving")
        .action((epicName, opts) => {
        const location = locateEpic(root, epicName);
        if (!location) {
            respond({ status: "error", command: "archive", error: `Epic not found: ${epicName}` });
            return;
        }
        if (location.lane === "5-archive") {
            respond({ status: "error", command: "archive", error: `Epic "${epicName}" is already archived` });
            return;
        }
        moveDir(root, epicName, location.lane, "5-archive");
        const newDir = join(twistedDir(root), "5-archive", epicName);
        const state = readCoreState(newDir);
        state.lane = "5-archive";
        state.status = "done";
        state.updated = new Date().toISOString();
        writeCoreState(newDir, state);
        const displayReason = opts.reason ? ` Reason: ${opts.reason}` : "";
        respond({
            status: "ok",
            command: "archive",
            display: `Epic "${epicName}" archived.${displayReason}`,
            epic: state,
        });
    });
    // ─── next ──────────────────────────────────────────────────────────────────
    program
        .command("next")
        .description("Advance active step")
        .argument("[epic]", "epic name")
        .action((epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let epicName;
        if (epicNameParam) {
            epicName = epicNameParam;
        }
        else {
            const active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "next", error: "No active epic. Run: tx open <name>" });
                return;
            }
            epicName = active.epicName;
        }
        const twistedRoot = twistedDir(root);
        const location = locateEpic(root, epicName);
        if (location) {
            ctx.ensureSession(location.dir, readCoreState(location.dir).step);
        }
        const result = txNext(twistedRoot, epicName, config);
        if (location && result.to_step) {
            ctx.logAction(location.dir, { type: "step", summary: `Advanced: ${result.from_step ?? "?"} → ${result.to_step}`, timestamp: new Date().toISOString() });
        }
        respond({ status: "ok", command: "next", display: JSON.stringify(result, null, 2) });
    });
    // ─── close ─────────────────────────────────────────────────────────────────
    program
        .command("close")
        .description("Run retro and close epic")
        .argument("[epic]", "epic name")
        .action(async (epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "close", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "close", error: "No active epic. Run: tx open <name>" });
                return;
            }
        }
        let retroSummary = "";
        try {
            const { candidates } = writeRetro(active.dir, active.epicName);
            if (candidates.length > 0) {
                retroSummary = `\n  Backlog candidates: ${candidates.length} (run: tx backlog)`;
            }
        }
        catch {
            // Non-fatal — retro is best-effort
        }
        respond({
            status: "handoff",
            command: "close",
            epic: active.state,
            action: {
                type: "prompt_user",
                prompt: `Epic "${active.epicName}" is ready to close.\n\nComplete QA, write changelog entry (pipe to: tx write changelog -a), then ship.`,
            },
            display: `Close: ${active.epicName}${retroSummary}`,
        });
    });
    // ─── resume ────────────────────────────────────────────────────────────────
    program
        .command("resume")
        .description("Resume named epic")
        .argument("<epic>", "epic name")
        .action((epicNameParam) => {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
            respond({ status: "error", command: "resume", error: `Epic '${epicNameParam}' not found` });
            return;
        }
        const state = readCoreState(location.dir);
        const session = readActiveSession(location.dir);
        respond({
            status: "ok",
            command: "resume",
            epic: state,
            session: { active: session, previous: null },
            display: `Resuming: ${epicNameParam}\n  Step: ${state.step}\n  Status: ${state.status}`,
        });
    });
    // ─── status ────────────────────────────────────────────────────────────────
    program
        .command("status")
        .description("Show status")
        .argument("[epic]", "epic name")
        .action((epicArg) => {
        const globalEpic = program.opts().epic;
        const targetName = epicArg ?? globalEpic;
        if (targetName) {
            const location = locateEpic(root, targetName);
            if (!location) {
                respond({ status: "error", command: "status", error: `Epic '${targetName}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            const display = `${state.epic}  |  ${state.lane}  |  ${state.step}  |  ${state.status}`;
            respond({ status: "ok", command: "status", epic: state, display });
        }
        else {
            const epics = findEpics(root);
            if (epics.length === 0) {
                respond({ status: "ok", command: "status", display: "No epics." });
                return;
            }
            const lines = epics.map((e) => {
                try {
                    const s = readCoreState(e.dir);
                    return `${s.epic}  ${s.lane}  ${s.step}  ${s.status}  ${s.tasks_done}/${s.tasks_total ?? "?"}  ${s.updated}`;
                }
                catch {
                    return `${e.epic}  (unreadable state)`;
                }
            });
            respond({ status: "ok", command: "status", display: lines.join("\n") });
        }
    });
}
//# sourceMappingURL=lifecycle.js.map