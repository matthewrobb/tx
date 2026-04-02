import { join } from "path";
import { locateEpic, ensureDir, writeArtifact, findEpics, readStories, writeStories } from "../fs.js";
import { readCandidates, promoteCandidateById } from "../../engine/retro.js";
import { promoteEpic } from "../../engine/promote.js";
import { createStory, markStoryDone, findStory, buildStoriesFile, formatStory } from "../../stories/stories.js";
export function registerEpicCommands(program, ctx) {
    const { root, config, respond } = ctx;
    // ─── estimate ──────────────────────────────────────────────────────────────
    program
        .command("estimate")
        .description("Set estimate for an epic")
        .argument("<epic>", "epic name")
        .requiredOption("--size <size>", "t-shirt size (XS|S|M|L|XL)")
        .requiredOption("--rationale <rationale>", "rationale text")
        .option("--timebox <timebox>", "timebox constraint")
        .option("--confidence <n>", "confidence 1-5", "3")
        .action((epicName, opts) => {
        const location = locateEpic(root, epicName);
        if (!location) {
            respond({ status: "error", command: "estimate", error: `Epic not found: ${epicName}` });
            return;
        }
        const confidence = parseInt(opts.confidence, 10);
        const now = new Date().toISOString();
        const estimate = {
            epic: epicName,
            size: opts.size,
            confidence,
            rationale: opts.rationale,
            ...(opts.timebox ? { timebox: opts.timebox } : {}),
            created: now,
            updated: now,
        };
        ensureDir(location.dir);
        writeArtifact(join(location.dir, "estimate.json"), JSON.stringify(estimate, null, 2) + "\n");
        respond({
            status: "ok",
            command: "estimate",
            display: `Estimate written for "${epicName}": ${opts.size} (confidence: ${confidence}/5)`,
        });
    });
    // ─── promote ───────────────────────────────────────────────────────────────
    program
        .command("promote")
        .description("Promote spike to typed epic")
        .argument("<epic>", "epic name")
        .requiredOption("--type <type>", "target type (feature|bug|chore|release)")
        .action((epicName, opts) => {
        const targetType = opts.type;
        try {
            const result = promoteEpic(root, epicName, targetType, config);
            respond({
                status: "ok",
                command: "promote",
                display: `Promoted "${epicName}" from spike to ${result.to_type} (${result.from_lane} → ${result.to_lane})`,
                epic: result.state,
            });
        }
        catch (err) {
            respond({ status: "error", command: "promote", error: String(err) });
        }
    });
    // ─── stories ───────────────────────────────────────────────────────────────
    // Pattern: tx stories <epic> [add <summary> | done <id> | show <id>]
    // Commander can't cleanly mix positional args + subcommands on the same level,
    // so we take variadic args and dispatch manually.
    program
        .command("stories")
        .description("Manage stories for an epic")
        .argument("<epic>", "epic name")
        .argument("[action]", "action: add | done | show (omit to list)")
        .argument("[arg]", "summary (for add) or story ID (for done/show)")
        .action((epicName, action, arg) => {
        const location = locateEpic(root, epicName);
        if (!location) {
            respond({ status: "error", command: "stories", error: `Epic not found: ${epicName}` });
            return;
        }
        const storiesFile = readStories(location.dir);
        if (action === "add") {
            const summary = arg;
            if (!summary) {
                respond({ status: "error", command: "stories", error: "Summary required: tx stories <epic> add <summary>" });
                return;
            }
            const existing = storiesFile?.stories ?? [];
            const story = createStory(existing, summary);
            const updated = buildStoriesFile(epicName, [...existing, story]);
            updated.created = storiesFile?.created ?? updated.created;
            writeStories(location.dir, updated);
            respond({ status: "ok", command: "stories", display: `Added: ${formatStory(story)}` });
        }
        else if (action === "done") {
            const id = arg;
            if (!id || !storiesFile) {
                respond({ status: "error", command: "stories", error: "Story ID required and stories must exist" });
                return;
            }
            const updated = { ...storiesFile, stories: markStoryDone(storiesFile.stories, id), updated: new Date().toISOString() };
            writeStories(location.dir, updated);
            respond({ status: "ok", command: "stories", display: `Marked done: ${id}` });
        }
        else if (action === "show") {
            const id = arg;
            if (!id || !storiesFile) {
                respond({ status: "error", command: "stories", error: "Story ID required" });
                return;
            }
            const story = findStory(storiesFile.stories, id);
            if (!story) {
                respond({ status: "error", command: "stories", error: `Story not found: ${id}` });
                return;
            }
            const lines = [formatStory(story), "", "Acceptance:", ...story.acceptance.map((a) => `  - ${a}`)];
            respond({ status: "ok", command: "stories", display: lines.join("\n") });
        }
        else {
            // List
            if (!storiesFile || storiesFile.stories.length === 0) {
                respond({ status: "ok", command: "stories", display: `No stories for "${epicName}". Run: tx stories ${epicName} add <summary>` });
            }
            else {
                const lines = storiesFile.stories.map(formatStory);
                respond({ status: "ok", command: "stories", display: lines.join("\n") });
            }
        }
    });
    // ─── backlog ───────────────────────────────────────────────────────────────
    const backlogCmd = program
        .command("backlog")
        .description("List backlog candidates")
        .action(() => {
        const epics = findEpics(root);
        const allCandidates = epics.flatMap(({ dir }) => readCandidates(dir));
        if (allCandidates.length === 0) {
            respond({ status: "ok", command: "backlog", display: "No backlog candidates." });
        }
        else {
            const lines = allCandidates.map((c) => `[${c.id}] ${c.promoted ? "✓" : "○"} ${c.summary}`);
            respond({ status: "ok", command: "backlog", display: lines.join("\n") });
        }
    });
    backlogCmd
        .command("promote")
        .description("Mark backlog candidate as promoted")
        .argument("<id>", "candidate ID")
        .action((candidateId) => {
        const epics = findEpics(root);
        let found = false;
        for (const { dir } of epics) {
            const candidates = readCandidates(dir);
            if (candidates.some((c) => c.id === candidateId)) {
                promoteCandidateById(dir, candidateId);
                found = true;
                respond({ status: "ok", command: "backlog", display: `Backlog candidate ${candidateId} marked as promoted.` });
                break;
            }
        }
        if (!found) {
            respond({ status: "error", command: "backlog", error: `Candidate not found: ${candidateId}` });
        }
    });
}
//# sourceMappingURL=epic.js.map