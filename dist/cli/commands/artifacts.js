import { join } from "path";
import { locateEpic, readCoreState, writeArtifact, readArtifact, listEpicFiles } from "../fs.js";
const ARTIFACT_TYPES = ["research", "scope", "plan", "changelog"];
export function registerArtifactsCommands(program, ctx) {
    const { root, respond } = ctx;
    // ─── write ─────────────────────────────────────────────────────────────────
    program
        .command("write")
        .description("Write artifact (reads from stdin)")
        .argument("<type>", "artifact type (research|scope|plan|changelog)")
        .argument("[epic]", "epic name")
        .action(async (type, epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "write", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "write", error: "No active epic" });
                return;
            }
        }
        if (!ARTIFACT_TYPES.includes(type)) {
            respond({ status: "error", command: "write", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
            return;
        }
        const content = await ctx.readStdin();
        let artifactPath;
        if (type === "research") {
            artifactPath = join(active.dir, "research", "research.md");
        }
        else if (type === "changelog") {
            artifactPath = join(root, "CHANGELOG.md");
        }
        else {
            artifactPath = join(active.dir, `${type}.md`);
        }
        writeArtifact(artifactPath, content);
        respond({ status: "ok", command: "write", display: `Wrote ${type} to ${artifactPath}` });
    });
    // ─── read ──────────────────────────────────────────────────────────────────
    program
        .command("read")
        .description("Read artifact (to stdout)")
        .argument("<type>", "artifact type (research|scope|plan|changelog)")
        .argument("[epic]", "epic name")
        .action((type, epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "read", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "read", error: "No active epic" });
                return;
            }
        }
        if (!ARTIFACT_TYPES.includes(type)) {
            respond({ status: "error", command: "read", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
            return;
        }
        let artifactPath;
        if (type === "research") {
            artifactPath = join(active.dir, "research", "research.md");
        }
        else if (type === "changelog") {
            artifactPath = join(root, "CHANGELOG.md");
        }
        else {
            artifactPath = join(active.dir, `${type}.md`);
        }
        try {
            const content = readArtifact(artifactPath);
            if (program.opts().agent) {
                respond({ status: "ok", command: "read", display: content });
            }
            else {
                process.stdout.write(content);
            }
        }
        catch {
            respond({ status: "error", command: "read", error: `Artifact not found: ${artifactPath}` });
        }
    });
    // ─── artifacts ─────────────────────────────────────────────────────────────
    program
        .command("artifacts")
        .description("List artifacts")
        .argument("[epic]", "epic name")
        .action((epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "artifacts", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "artifacts", error: "No active epic" });
                return;
            }
        }
        const { files } = listEpicFiles(active.dir);
        const display = files.map((f) => `  ${f}`).join("\n");
        respond({ status: "ok", command: "artifacts", display: display || "No artifacts." });
    });
}
//# sourceMappingURL=artifacts.js.map