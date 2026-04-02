/**
 * Retro note aggregation — collects notes from a completed epic and produces retro.md.
 *
 * Called at close time. Reads all notes, groups retro-typed notes, and writes
 * retro.md + backlog-candidates.json to the epic's done lane directory.
 */
import type { RetroNote, BacklogCandidate } from "../types/index.js";
/**
 * Aggregate retro notes from an epic's notes.json into retro.md.
 *
 * @param epicDir - Absolute path to the epic's lane directory.
 * @param epicName - Epic name (used in output).
 */
export declare function aggregateRetro(epicDir: string, epicName: string): {
    retro: RetroNote[];
    candidates: BacklogCandidate[];
    retroMd: string;
};
/**
 * Write retro.md and backlog-candidates.json to the epic directory.
 */
export declare function writeRetro(epicDir: string, epicName: string): {
    retroMd: string;
    candidates: BacklogCandidate[];
};
/**
 * Read backlog candidates from an epic directory.
 */
export declare function readCandidates(epicDir: string): BacklogCandidate[];
/**
 * Mark a backlog candidate as promoted and return the updated list.
 */
export declare function promoteCandidateById(epicDir: string, candidateId: string): BacklogCandidate[];
//# sourceMappingURL=retro.d.ts.map