// src/cli/fs.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import type { ObjectiveState } from "../../types/state.js";
import type { Task } from "../../types/tasks.js";
import type { Note } from "../../types/notes.js";
import type { ActiveSession, SessionSummary } from "../../types/session.js";

// Use a loose type for settings since TwistedSettings may not exist
type SettingsData = Record<string, unknown>;

export function findRoot(cwd: string): string {
  return process.env.TWISTED_ROOT ?? cwd;
}

export function twistedDir(root: string): string {
  return join(root, ".twisted");
}

export function objectiveDir(root: string, lane: string, objective: string): string {
  return join(twistedDir(root), lane, objective);
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

// --- State ---

export function readState(objDir: string): ObjectiveState {
  return JSON.parse(readFileSync(join(objDir, "state.json"), "utf-8"));
}

export function writeState(objDir: string, state: ObjectiveState): void {
  writeFileSync(join(objDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

// --- Tasks ---

export function readTasks(objDir: string): Task[] {
  const path = join(objDir, "tasks.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeTasks(objDir: string, tasks: Task[]): void {
  writeFileSync(join(objDir, "tasks.json"), JSON.stringify(tasks, null, 2) + "\n");
}

// --- Notes ---

export function readNotes(objDir: string): Note[] {
  const path = join(objDir, "notes.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeNotes(objDir: string, notes: Note[]): void {
  writeFileSync(join(objDir, "notes.json"), JSON.stringify(notes, null, 2) + "\n");
}

// --- Sessions ---

export function readActiveSession(objDir: string): ActiveSession | null {
  const path = join(objDir, "sessions/active.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeActiveSession(objDir: string, session: ActiveSession): void {
  const dir = join(objDir, "sessions");
  ensureDir(dir);
  writeFileSync(join(dir, "active.json"), JSON.stringify(session, null, 2) + "\n");
}

export function deleteActiveSession(objDir: string): void {
  const path = join(objDir, "sessions/active.json");
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function listSessions(objDir: string): SessionSummary[] {
  const dir = join(objDir, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const match = f.match(/^(\d+)-(.+)\.md$/);
      if (!match) return null;
      return { number: parseInt(match[1]!, 10), name: match[2]!, file: f };
    })
    .filter((s): s is SessionSummary => s !== null);
}

// --- Settings ---

export function readSettings(root: string): SettingsData {
  const path = join(twistedDir(root), "settings.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeSettings(root: string, settings: SettingsData): void {
  const path = join(twistedDir(root), "settings.json");
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}

// --- Artifacts ---

export function writeArtifact(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

export function readArtifact(path: string): string {
  return readFileSync(path, "utf-8");
}

// --- File listing ---

export function listObjectiveFiles(objDir: string): { dir: string; files: string[] } {
  const dir = objDir.replace(/\\/g, "/");
  const entries = readdirSync(objDir, { recursive: true }) as string[];
  const files = entries.map((f) => join(objDir, f).replace(/\\/g, "/"));
  return { dir, files };
}

// --- Scanning ---

export function findObjectives(root: string): Array<{ lane: string; objective: string; dir: string }> {
  const twisted = twistedDir(root);
  const results: Array<{ lane: string; objective: string; dir: string }> = [];

  for (const lane of ["todo", "in-progress", "done"]) {
    const laneDir = join(twisted, lane);
    if (!existsSync(laneDir)) continue;
    for (const entry of readdirSync(laneDir)) {
      const objDir = join(laneDir, entry);
      if (existsSync(join(objDir, "state.json"))) {
        results.push({ lane, objective: entry, dir: objDir });
      }
    }
  }

  return results;
}
