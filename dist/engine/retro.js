/**
 * Retro note aggregation — collects notes from a completed epic and produces retro.md.
 *
 * Called at close time. Reads all notes, groups retro-typed notes, and writes
 * retro.md + backlog-candidates.json to the epic's done lane directory.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
/**
 * Aggregate retro notes from an epic's notes.json into retro.md.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param epicName - Epic name (used in output).
 */
export function aggregateRetro(epicDir, epicName) {
    const notesPath = join(epicDir, "notes.json");
    const notes = existsSync(notesPath)
        ? JSON.parse(readFileSync(notesPath, "utf-8"))
        : [];
    // Extract retro-typed notes and deferral notes as retro candidates
    const retroNotes = [];
    const candidates = [];
    let noteSeq = 1;
    let candidateSeq = 1;
    for (const note of notes) {
        if (note.type === "retro") {
            retroNotes.push({
                id: `R-${String(noteSeq++).padStart(3, "0")}`,
                epic: epicName,
                summary: note.summary,
                category: "carry-forward",
                created: note.created,
            });
        }
        // Deferral notes become backlog candidates
        if (note.type === "deferral") {
            const candidate = {
                id: `BC-${String(candidateSeq++).padStart(3, "0")}`,
                source_note_id: String(note.id),
                summary: note.summary,
                suggested_type: "chore",
                promoted: false,
                created: note.created,
            };
            candidates.push(candidate);
        }
    }
    const retroMd = buildRetroMd(epicName, retroNotes, candidates, notes);
    return { retro: retroNotes, candidates, retroMd };
}
function buildRetroMd(epicName, retro, candidates, allNotes) {
    const decisions = allNotes.filter((n) => n.type === "decision");
    const blockers = allNotes.filter((n) => n.type === "blocker");
    const lines = [
        `# Retro: ${epicName}`,
        "",
        `_Generated: ${new Date().toISOString().slice(0, 10)}_`,
        "",
    ];
    if (decisions.length > 0) {
        lines.push("## Key Decisions", "");
        for (const d of decisions) {
            lines.push(`- ${d.summary}${d.reason ? ` _(${d.reason})_` : ""}`);
        }
        lines.push("");
    }
    if (blockers.length > 0) {
        lines.push("## Blockers Encountered", "");
        for (const b of blockers) {
            lines.push(`- ${b.summary}`);
        }
        lines.push("");
    }
    if (retro.length > 0) {
        lines.push("## Retrospective Notes", "");
        for (const r of retro) {
            lines.push(`- [${r.id}] ${r.summary}`);
        }
        lines.push("");
    }
    if (candidates.length > 0) {
        lines.push("## Backlog Candidates", "");
        for (const c of candidates) {
            lines.push(`- [${c.id}] ${c.summary} _(from deferral ${c.source_note_id})_`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
/**
 * Write retro.md and backlog-candidates.json to the epic directory.
 */
export function writeRetro(epicDir, epicName) {
    const { retroMd, candidates } = aggregateRetro(epicDir, epicName);
    writeFileSync(join(epicDir, "retro.md"), retroMd, "utf-8");
    if (candidates.length > 0) {
        writeFileSync(join(epicDir, "backlog-candidates.json"), JSON.stringify(candidates, null, 2), "utf-8");
    }
    return { retroMd, candidates };
}
/**
 * Read backlog candidates from an epic directory.
 */
export function readCandidates(epicDir) {
    const path = join(epicDir, "backlog-candidates.json");
    if (!existsSync(path))
        return [];
    return JSON.parse(readFileSync(path, "utf-8"));
}
/**
 * Mark a backlog candidate as promoted and return the updated list.
 */
export function promoteCandidateById(epicDir, candidateId) {
    const candidates = readCandidates(epicDir);
    const updated = candidates.map((c) => c.id === candidateId ? { ...c, promoted: true } : c);
    writeFileSync(join(epicDir, "backlog-candidates.json"), JSON.stringify(updated, null, 2), "utf-8");
    return updated;
}
//# sourceMappingURL=retro.js.map