#!/usr/bin/env node
// src/cli/index.ts
import { parseArgs } from "./args.js";
import { output } from "./output.js";
import { resolveConfig } from "../config/resolve.js";
import {
  findRoot, twistedDir, ensureDir,
  readActiveSession, writeActiveSession, deleteActiveSession,
  listSessions, findEpics, locateEpic, readCoreState, writeCoreState,
  writeArtifact, readArtifact, listEpicFiles,
  readNotes, writeNotes, readTasks, writeTasks,
  readStories, writeStories,
  moveDir, writeSettings,
} from "./fs.js";
import { writeRetro, readCandidates, promoteCandidateById } from "../engine/retro.js";
import { txNext } from "../engine/next.js";
import { promoteEpic } from "../engine/promote.js";
import { createStory, markStoryDone, findStory, buildStoriesFile, formatStory } from "../stories/stories.js";
import { syncAgentSymlinks, agentsDir } from "../agents/generate.js";
import type { AgentResponse } from "../types/output.js";
import type { TwistedConfig } from "../types/config.js";
import type { NoteType } from "../types/notes.js";
import type { ArtifactType } from "../types/commands.js";
import type { EpicType } from "../types/epic.js";
import type { Task } from "../types/tasks.js";
import type { ActiveSession } from "../types/session.js";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const ARTIFACT_TYPES: ArtifactType[] = ["research", "scope", "plan", "changelog"];

const argv = process.argv.slice(2);
const command = parseArgs(argv);
const root = findRoot(process.cwd());

function loadSettings(): Record<string, unknown> {
  const path = join(twistedDir(root), "settings.json");
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return {}; }
}

const settings = loadSettings();
const config: TwistedConfig = resolveConfig(settings);

function respond(response: AgentResponse): void {
  output(response, command.flags.agent);
}

/**
 * Find the active epic, respecting -e/-o flags.
 * Returns { dir, state } or null.
 */
function findActiveEpic(): { dir: string; epicName: string; state: ReturnType<typeof readCoreState> } | null {
  const epicFlag = command.flags.epic;
  if (epicFlag) {
    const location = locateEpic(root, epicFlag);
    if (!location) return null;
    const state = readCoreState(location.dir);
    return { dir: location.dir, epicName: epicFlag, state };
  }
  const epics = findEpics(root);
  const active = epics
    .map((e) => {
      try {
        const state = readCoreState(e.dir);
        return { dir: e.dir, epicName: e.epic, state };
      } catch {
        return null;
      }
    })
    .filter((e): e is { dir: string; epicName: string; state: ReturnType<typeof readCoreState> } =>
      e !== null && e.state.status === "active"
    )
    .sort((a, b) => b.state.updated.localeCompare(a.state.updated));
  if (active.length === 0) return null;
  return active[0]!;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main(): Promise<void> {
  switch (command.subcommand) {
    case "init": {
      const twisted = twistedDir(root);
      // v4 lanes
      for (const lane of ["0-backlog", "1-ready", "2-active", "3-review", "4-done", "5-archive"]) {
        ensureDir(join(twisted, lane));
      }
      // Agent symlinks directory
      ensureDir(agentsDir(root));
      // Sync agent symlinks for any existing epics
      try {
        const epics = findEpics(root);
        syncAgentSymlinks(root, epics);
      } catch {
        // Non-fatal — agent symlinks are best-effort
      }
      const currentSettings = loadSettings();
      if (!currentSettings || Object.keys(currentSettings).length === 0) {
        writeSettings(root, { $schema: "./schemas/settings.schema.json" });
      }
      respond({ status: "ok", command: "init", display: "Initialized .twisted/", config: config as unknown as Record<string, unknown> });
      break;
    }

    case "open": {
      const params = command.params as Record<string, unknown>;
      const epicName = params.epic as string | undefined;
      if (!epicName) {
        respond({ status: "error", command: "open", error: "Epic name required: tx open <name>" });
        break;
      }
      const epicType = (params.type as EpicType | undefined) ?? "feature";
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const dir = join(twistedDir(root), "0-backlog", epicName);
      ensureDir(dir);
      ensureDir(join(dir, "sessions"));
      const state = {
        epic: epicName,
        type: epicType,
        lane: "0-backlog",
        step: "start",
        status: "active" as const,
        tasks_done: 0,
        tasks_total: null,
        created: today,
        updated: now,
      };
      writeCoreState(dir, state);
      writeNotes(dir, []);
      writeTasks(dir, []);
      respond({ status: "ok", command: "open", epic: state, display: `Opened epic: ${epicName}\nLane: 0-backlog\nStep: start` });
      break;
    }

    case "status": {
      const params = command.params as Record<string, unknown>;
      const targetName = params.epic as string | undefined;
      if (targetName) {
        const location = locateEpic(root, targetName);
        if (!location) {
          respond({ status: "error", command: "status", error: `Epic '${targetName}' not found` });
          break;
        }
        const state = readCoreState(location.dir);
        const display = `${state.epic}  |  ${state.lane}  |  ${state.step}  |  ${state.status}`;
        respond({ status: "ok", command: "status", epic: state, display });
      } else {
        const epics = findEpics(root);
        if (epics.length === 0) {
          respond({ status: "ok", command: "status", display: "No epics." });
          break;
        }
        const lines = epics.map((e) => {
          try {
            const s = readCoreState(e.dir);
            return `${s.epic}  ${s.lane}  ${s.step}  ${s.status}  ${s.tasks_done}/${s.tasks_total ?? "?"}  ${s.updated}`;
          } catch {
            return `${e.epic}  (unreadable state)`;
          }
        });
        respond({ status: "ok", command: "status", display: lines.join("\n") });
      }
      break;
    }

    case "next": {
      const params = command.params as Record<string, unknown>;
      const epicNameParam = params.epic as string | undefined;
      let epicName: string;
      if (epicNameParam) {
        epicName = epicNameParam;
      } else {
        const active = findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "next", error: "No active epic. Run: tx open <name>" });
          break;
        }
        epicName = active.epicName;
      }
      const twistedRoot = twistedDir(root);
      const result = txNext(twistedRoot, epicName, config);
      respond({ status: "ok", command: "next", display: JSON.stringify(result, null, 2) });
      break;
    }

    case "close": {
      const params = command.params as Record<string, unknown>;
      const epicNameParam = params.epic as string | undefined;
      let active: ReturnType<typeof findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "close", error: `Epic '${epicNameParam}' not found` });
          break;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "close", error: "No active epic. Run: tx open <name>" });
          break;
        }
      }

      let retroSummary = "";
      try {
        const { candidates } = writeRetro(active.dir, active.epicName);
        if (candidates.length > 0) {
          retroSummary = `\n  Backlog candidates: ${candidates.length} (run: tx backlog)`;
        }
      } catch {
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
      break;
    }

    case "resume": {
      const params = command.params as Record<string, unknown>;
      const epicNameParam = params.epic as string | undefined;
      if (!epicNameParam) {
        respond({ status: "error", command: "resume", error: "Epic name required: tx resume <name>" });
        break;
      }
      const location = locateEpic(root, epicNameParam);
      if (!location) {
        respond({ status: "error", command: "resume", error: `Epic '${epicNameParam}' not found` });
        break;
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
      break;
    }

    case "research":
    case "scope":
    case "plan":
    case "build": {
      const stepName = command.subcommand;
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: stepName, error: "No active epic" });
        break;
      }
      if (active.state.step !== stepName) {
        respond({
          status: "error",
          command: stepName,
          error: `Epic is at step "${active.state.step}", not "${stepName}"`,
          epic: active.state,
        });
        break;
      }
      respond({
        status: "handoff",
        command: stepName,
        epic: active.state,
        action: {
          type: "prompt_user",
          prompt: `Execute the ${stepName} step for epic "${active.epicName}".`,
        },
        display: `Step: ${stepName} (epic: ${active.epicName})`,
      });
      break;
    }

    case "note": {
      const params = command.params as Record<string, unknown>;
      const summary = params.summary as string;
      if (!summary) {
        respond({ status: "error", command: "note", error: "Summary required: tx note <summary>" });
        break;
      }
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "note", error: "No active epic" });
        break;
      }
      const noteType = (params.type as NoteType | undefined) ?? "note";
      const reason = params.reason as string | undefined;
      const impact = params.impact as string | undefined;
      const notes = readNotes(active.dir);
      const newNote = {
        id: notes.length + 1,
        type: noteType,
        step: active.state.step,
        summary,
        ...(reason ? { reason } : {}),
        ...(impact ? { impact } : {}),
        created: new Date().toISOString(),
      };
      notes.push(newNote);
      writeNotes(active.dir, notes);
      respond({ status: "ok", command: "note", display: `Note #${newNote.id}: ${summary}` });
      break;
    }

    case "notes": {
      const params = command.params as Record<string, unknown>;
      const epicNameParam = params.epic as string | undefined;
      let active: ReturnType<typeof findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "notes", error: `Epic '${epicNameParam}' not found` });
          break;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "notes", error: "No active epic" });
          break;
        }
      }
      const notes = readNotes(active.dir);
      const filterType = params.type as NoteType | undefined;
      const filterStep = params.step as string | undefined;
      const filtered = notes.filter((n) => {
        if (filterType && n.type !== filterType) return false;
        if (filterStep && n.step !== filterStep) return false;
        return true;
      });
      const display = filtered.map((n) => `#${n.id} [${n.type}] (${n.step}) ${n.summary}`).join("\n");
      respond({ status: "ok", command: "notes", display: display || "No notes." });
      break;
    }

    case "tasks": {
      const params = command.params as Record<string, unknown>;
      const action = params.action as string | undefined;

      // Determine the target epic
      const epicNameParam = (!action || !["add", "update", "assign", "show"].includes(action))
        ? (params.epic as string | undefined)
        : undefined;
      let active: ReturnType<typeof findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "tasks", error: `Epic '${epicNameParam}' not found` });
          break;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "tasks", error: "No active epic" });
          break;
        }
      }

      const tasks = readTasks(active.dir) as unknown as Task[];

      if (!action || !["add", "update", "show"].includes(action)) {
        // List
        const display = tasks.map((t) => `#${t.id} [${t.done ? "x" : " "}] ${t.summary}${t.group ? ` (${t.group})` : ""}`).join("\n");
        respond({ status: "ok", command: "tasks", display: display || "No tasks." });
        break;
      }

      if (action === "add") {
        const summary = params.summary as string | undefined;
        if (!summary) {
          respond({ status: "error", command: "tasks", error: "Summary required: tx tasks add <summary>" });
          break;
        }
        const maxId = tasks.reduce((max, t) => {
          const n = parseInt(t.id.replace("T-", ""), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const newTask: Task = {
          id: `T-${String(maxId + 1).padStart(3, "0")}`,
          summary,
          done: false,
          group: null,
        };
        tasks.push(newTask);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        writeTasks(active.dir, tasks as any);
        respond({ status: "ok", command: "tasks", display: `Task ${newTask.id}: ${summary}` });

      } else if (action === "update") {
        // id may be parsed as number (from args.ts parseInt) or string
        const rawId = params.id;
        const idStr = typeof rawId === "number"
          ? `T-${String(rawId).padStart(3, "0")}`
          : String(rawId);
        const task = tasks.find((t) => t.id === idStr || t.id === String(rawId));
        if (!task) {
          respond({ status: "error", command: "tasks", error: `Task not found: ${idStr}` });
          break;
        }
        if (params.done === true) task.done = true;
        else if (params.done === false) task.done = false;
        const group = params.group as string | undefined;
        if (group !== undefined) task.group = group;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        writeTasks(active.dir, tasks as any);
        respond({ status: "ok", command: "tasks", display: `Updated task ${task.id}` });

      } else if (action === "show") {
        const rawId = params.id;
        const idStr = typeof rawId === "number"
          ? `T-${String(rawId).padStart(3, "0")}`
          : String(rawId);
        const task = tasks.find((t) => t.id === idStr || t.id === String(rawId));
        if (!task) {
          respond({ status: "error", command: "tasks", error: `Task not found: ${idStr}` });
          break;
        }
        respond({ status: "ok", command: "tasks", display: JSON.stringify(task, null, 2) });
      }
      break;
    }

    case "write": {
      const params = command.params as Record<string, unknown>;
      const type = params.type as string;
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "write", error: "No active epic" });
        break;
      }
      if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
        respond({ status: "error", command: "write", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
        break;
      }
      const content = await readStdin();
      let artifactPath: string;
      if (type === "research") {
        artifactPath = join(active.dir, "research", "research.md");
      } else if (type === "changelog") {
        artifactPath = join(root, "CHANGELOG.md");
      } else {
        artifactPath = join(active.dir, `${type}.md`);
      }
      writeArtifact(artifactPath, content);
      respond({ status: "ok", command: "write", display: `Wrote ${type} to ${artifactPath}` });
      break;
    }

    case "read": {
      const params = command.params as Record<string, unknown>;
      const type = params.type as string;
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "read", error: "No active epic" });
        break;
      }
      if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
        respond({ status: "error", command: "read", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
        break;
      }
      let artifactPath: string;
      if (type === "research") {
        artifactPath = join(active.dir, "research", "research.md");
      } else if (type === "changelog") {
        artifactPath = join(root, "CHANGELOG.md");
      } else {
        artifactPath = join(active.dir, `${type}.md`);
      }
      try {
        const content = readArtifact(artifactPath);
        if (command.flags.agent) {
          respond({ status: "ok", command: "read", display: content });
        } else {
          process.stdout.write(content);
        }
      } catch {
        respond({ status: "error", command: "read", error: `Artifact not found: ${artifactPath}` });
      }
      break;
    }

    case "artifacts": {
      const params = command.params as Record<string, unknown>;
      const epicNameParam = params.epic as string | undefined;
      let active: ReturnType<typeof findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "artifacts", error: `Epic '${epicNameParam}' not found` });
          break;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "artifacts", error: "No active epic" });
          break;
        }
      }
      const { files } = listEpicFiles(active.dir);
      const display = files.map((f) => `  ${f}`).join("\n");
      respond({ status: "ok", command: "artifacts", display: display || "No artifacts." });
      break;
    }

    case "pickup": {
      const params = command.params as Record<string, unknown>;
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "pickup", error: "No active epic" });
        break;
      }
      const existing = readActiveSession(active.dir);
      if (existing) {
        respond({
          status: "ok",
          command: "pickup",
          session: { active: existing, previous: null },
          display: `Resuming session #${existing.number} (started ${existing.started})`,
        });
        break;
      }
      const sessions = listSessions(active.dir);
      const nextNumber = sessions.length > 0
        ? Math.max(...sessions.map((s) => s.number)) + 1
        : 1;
      const name = (params.name as string | null) ?? null;
      const sess: ActiveSession = {
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
      break;
    }

    case "handoff": {
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "handoff", error: "No active epic" });
        break;
      }
      const session = readActiveSession(active.dir);
      if (!session) {
        respond({ status: "error", command: "handoff", error: "No active session" });
        break;
      }
      const ended = new Date().toISOString();
      writeActiveSession(active.dir, { ...session, ended } as unknown as ActiveSession);
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
      break;
    }

    case "session": {
      const params = command.params as Record<string, unknown>;
      const action = params.action as string | undefined;
      const active = findActiveEpic();
      if (!active) {
        respond({ status: "error", command: "session", error: "No active epic" });
        break;
      }
      if (action === "status") {
        const sess = readActiveSession(active.dir);
        if (sess) {
          respond({ status: "ok", command: "session", session: { active: sess, previous: null }, display: JSON.stringify(sess, null, 2) });
        } else {
          respond({ status: "ok", command: "session", display: "No active session." });
        }
      } else if (action === "save") {
        const sess = readActiveSession(active.dir);
        if (!sess) {
          respond({ status: "error", command: "session", error: "No active session to save" });
          break;
        }
        const sessName = (sess.name ?? `session-${sess.number}`) as string;
        const content = await readStdin();
        const sessionsDir = join(active.dir, "sessions");
        ensureDir(sessionsDir);
        const filename = `${sess.number}-${sessName}.md`;
        writeArtifact(join(sessionsDir, filename), content);
        deleteActiveSession(active.dir);
        respond({ status: "ok", command: "session", display: `Session saved: sessions/${filename}` });
      } else if (action === "list") {
        const sessions = listSessions(active.dir);
        const display = sessions.map((s) => `#${s.number} ${s.name} (${s.file})`).join("\n");
        respond({ status: "ok", command: "session", display: display || "No sessions." });
      } else {
        respond({ status: "error", command: "session", error: "Usage: tx session status|save|list" });
      }
      break;
    }

    case "config": {
      respond({ status: "ok", command: "config", config: config as unknown as Record<string, unknown>, display: JSON.stringify(config, null, 2) });
      break;
    }

    case "stories": {
      const p = command.params as Record<string, unknown>;
      const epicName = p.epic as string | undefined ?? command.flags.epic;
      if (!epicName) {
        respond({ status: "error", command: "stories", error: "Epic name required: tx stories <epic>" });
        break;
      }
      const location = locateEpic(root, epicName);
      if (!location) {
        respond({ status: "error", command: "stories", error: `Epic not found: ${epicName}` });
        break;
      }
      const action = p.action as string | undefined;
      const storiesFile = readStories(location.dir);

      if (action === "add") {
        const summary = p.summary as string | undefined;
        if (!summary) {
          respond({ status: "error", command: "stories", error: "Summary required: tx stories <epic> add <summary>" });
          break;
        }
        const existing = storiesFile?.stories ?? [];
        const story = createStory(existing, summary);
        const updated = buildStoriesFile(epicName, [...existing, story]);
        updated.created = storiesFile?.created ?? updated.created;
        writeStories(location.dir, updated);
        respond({ status: "ok", command: "stories", display: `Added: ${formatStory(story)}` });

      } else if (action === "done") {
        const id = p.id as string | undefined;
        if (!id || !storiesFile) {
          respond({ status: "error", command: "stories", error: "Story ID required and stories must exist" });
          break;
        }
        const updated = { ...storiesFile, stories: markStoryDone(storiesFile.stories, id), updated: new Date().toISOString() };
        writeStories(location.dir, updated);
        respond({ status: "ok", command: "stories", display: `Marked done: ${id}` });

      } else if (action === "show") {
        const id = p.id as string | undefined;
        if (!id || !storiesFile) {
          respond({ status: "error", command: "stories", error: "Story ID required" });
          break;
        }
        const story = findStory(storiesFile.stories, id);
        if (!story) {
          respond({ status: "error", command: "stories", error: `Story not found: ${id}` });
          break;
        }
        const lines = [formatStory(story), "", "Acceptance:", ...story.acceptance.map((a: string) => `  - ${a}`)];
        respond({ status: "ok", command: "stories", display: lines.join("\n") });

      } else {
        if (!storiesFile || storiesFile.stories.length === 0) {
          respond({ status: "ok", command: "stories", display: `No stories for "${epicName}". Run: tx stories ${epicName} add <summary>` });
        } else {
          const lines = storiesFile.stories.map(formatStory);
          respond({ status: "ok", command: "stories", display: lines.join("\n") });
        }
      }
      break;
    }

    case "estimate": {
      const p = command.params as Record<string, unknown>;
      const epicName = p.epic as string | undefined ?? command.flags.epic;
      if (!epicName) {
        respond({ status: "error", command: "estimate", error: "Epic name required: tx estimate <epic> --size <XS|S|M|L|XL> --rationale <text>" });
        break;
      }
      const location = locateEpic(root, epicName);
      if (!location) {
        respond({ status: "error", command: "estimate", error: `Epic not found: ${epicName}` });
        break;
      }
      const size = (p.size as string | undefined) ?? "M";
      const rationale = (p.rationale as string | undefined) ?? "";
      const confidence = (p.confidence as number | undefined) ?? 3;
      const timebox = p.timebox as string | undefined;
      const now = new Date().toISOString();
      const estimate = { epic: epicName, size, confidence, rationale, ...(timebox ? { timebox } : {}), created: now, updated: now };
      ensureDir(location.dir);
      writeArtifact(join(location.dir, "estimate.json"), JSON.stringify(estimate, null, 2) + "\n");
      respond({
        status: "ok",
        command: "estimate",
        display: `Estimate written for "${epicName}": ${size} (confidence: ${confidence}/5)`,
      });
      break;
    }

    case "promote": {
      const p = command.params as Record<string, unknown>;
      const epicName = p.epic as string | undefined ?? command.flags.epic;
      const targetType = p.type as EpicType | undefined;
      if (!epicName || !targetType) {
        respond({ status: "error", command: "promote", error: "Usage: tx promote <epic> --type <feature|bug|chore|release>" });
        break;
      }
      try {
        const result = promoteEpic(root, epicName, targetType, config);
        respond({
          status: "ok",
          command: "promote",
          display: `Promoted "${epicName}" from spike to ${result.to_type} (${result.from_lane} → ${result.to_lane})`,
          epic: result.state,
        });
      } catch (err) {
        respond({ status: "error", command: "promote", error: String(err) });
      }
      break;
    }

    case "backlog": {
      const p = command.params as Record<string, unknown>;
      const action = p.action as string | undefined;
      if (action === "promote") {
        const candidateId = p.id as string | undefined;
        if (!candidateId) {
          respond({ status: "error", command: "backlog", error: "Usage: tx backlog promote <candidate-id>" });
          break;
        }
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
        break;
      }
      const epics = findEpics(root);
      const allCandidates = epics.flatMap(({ dir }) => readCandidates(dir));
      if (allCandidates.length === 0) {
        respond({ status: "ok", command: "backlog", display: "No backlog candidates." });
      } else {
        const lines = allCandidates.map((c) => `[${c.id}] ${c.promoted ? "✓" : "○"} ${c.summary}`);
        respond({ status: "ok", command: "backlog", display: lines.join("\n") });
      }
      break;
    }

    case "ready": {
      const epicName = (command.params as Record<string, unknown>).epic as string | undefined
        ?? command.flags.epic;
      if (!epicName) {
        respond({ status: "error", command: "ready", error: "Epic name required: tx ready <epic>" });
        break;
      }
      const location = locateEpic(root, epicName);
      if (!location) {
        respond({ status: "error", command: "ready", error: `Epic not found: ${epicName}` });
        break;
      }
      if (location.lane !== "0-backlog") {
        respond({
          status: "error",
          command: "ready",
          error: `Epic "${epicName}" is in lane "${location.lane}", not "0-backlog"`,
        });
        break;
      }
      moveDir(root, epicName, "0-backlog", "1-ready");
      const newDir = join(twistedDir(root), "1-ready", epicName);
      const state = readCoreState(newDir);
      state.lane = "1-ready";
      state.step = "estimate";
      state.updated = new Date().toISOString();
      writeCoreState(newDir, state);
      respond({
        status: "ok",
        command: "ready",
        display: `Epic "${epicName}" moved to 1-ready`,
        epic: state,
      });
      break;
    }

    case "archive": {
      const epicName = (command.params as Record<string, unknown>).epic as string | undefined
        ?? command.flags.epic;
      const reason = (command.params as Record<string, unknown>).reason as string | undefined;
      if (!epicName) {
        respond({ status: "error", command: "archive", error: "Epic name required: tx archive <epic>" });
        break;
      }
      const location = locateEpic(root, epicName);
      if (!location) {
        respond({ status: "error", command: "archive", error: `Epic not found: ${epicName}` });
        break;
      }
      if (location.lane === "5-archive") {
        respond({ status: "error", command: "archive", error: `Epic "${epicName}" is already archived` });
        break;
      }
      moveDir(root, epicName, location.lane, "5-archive");
      const newDir = join(twistedDir(root), "5-archive", epicName);
      const state = readCoreState(newDir);
      state.lane = "5-archive";
      state.status = "done";
      state.updated = new Date().toISOString();
      writeCoreState(newDir, state);
      const displayReason = reason ? ` Reason: ${reason}` : "";
      respond({
        status: "ok",
        command: "archive",
        display: `Epic "${epicName}" archived.${displayReason}`,
        epic: state,
      });
      break;
    }

    default: {
      if (command.flags.version) {
        respond({ status: "ok", command: "version", display: `twisted-workflow v${config.version}` });
      } else if (command.flags.help) {
        respond({ status: "ok", command: "help", display: getHelpText() });
      } else {
        const epics = findEpics(root);
        if (epics.length === 0) {
          respond({ status: "ok", command: "interactive", display: "No epics. Run: tx open <name>" });
        } else {
          const lines = epics.map((e) => {
            try {
              const s = readCoreState(e.dir);
              return `${s.epic}  ${s.lane}  ${s.step}  ${s.status}`;
            } catch {
              return `${e.epic}  (unreadable state)`;
            }
          });
          respond({ status: "ok", command: "interactive", display: lines.join("\n") });
        }
      }
    }
  }
}

function getHelpText(): string {
  return `tx <command> [args] [flags]

Lifecycle:
  tx init                    Setup .twisted/
  tx open <epic>             Create epic (--type feature|bug|chore|release|spike)
  tx close [epic]            Run retro and close
  tx next [epic]             Advance active step
  tx resume <epic>           Resume named epic
  tx status [epic]           Show status

Steps:
  tx research [epic]         Run research step
  tx scope [epic]            Run scope step
  tx plan [epic]             Run plan step
  tx build [epic]            Run build step

Lane ops:
  tx ready <epic>            Move epic to 1-ready
  tx archive <epic>          Move epic to 5-archive
  tx promote <epic> --type   Promote spike to typed epic

Session:
  tx pickup [name]           Start session
  tx handoff                 End session
  tx session status|save|list

Artifacts:
  tx write <type> [epic]     Write (stdin)
  tx read <type> [epic]      Read (stdout)
  tx artifacts [epic]        List artifacts

Tasks:
  tx tasks [epic]            List tasks
  tx tasks add <summary>     Add task
  tx tasks update <id>       Update task (--done|--undone|--group <g>)
  tx tasks show <id>         Show detail

Notes:
  tx note <summary>          Add note (--note|--decide|--defer|--discover|--blocker)
  tx notes [epic]            Query notes

Stories:
  tx stories <epic>          List stories
  tx stories <epic> add <s>  Add story
  tx stories <epic> done <id>
  tx stories <epic> show <id>

Estimation:
  tx estimate <epic> --size --rationale --confidence

Backlog:
  tx backlog                 List backlog candidates
  tx backlog promote <id>    Mark candidate as promoted

Config:
  tx config                  Show config

Flags:
  -a, --agent       JSON output
  -y, --yolo        Skip confirmations
  -e, --epic        Target epic
  -h, --help        Show help
  -v, --version     Show version`;
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
