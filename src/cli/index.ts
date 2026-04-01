#!/usr/bin/env node
// src/cli/index.ts
import { parseArgs } from "./args.js";
import { output } from "./output.js";
import { resolveConfig } from "../config/resolve.js";
import { createInitialState, nextStep, advanceState } from "../state/machine.js";
import {
  findRoot, twistedDir, objectiveDir, ensureDir,
  readState, writeState, readSettings, writeSettings,
  readTasks, writeTasks, readNotes, writeNotes,
  readActiveSession, writeActiveSession, deleteActiveSession,
  listSessions, findObjectives, writeArtifact, readArtifact,
  listObjectiveFiles,
  // v4
  moveDir, locateEpic, readCoreState, writeCoreState, findEpics,
  readStories, writeStories,
} from "./fs.js";
import { addNote, filterNotes } from "../notes/notes.js";
import { addTask, updateTask, assignTask, getTask } from "../tasks/tasks.js";
import { createSession, addSessionEvent, closeSession, getLatestSession } from "../session/lifecycle.js";
import { resolveArtifactPath, listArtifacts } from "../artifacts/artifacts.js";
import { writeRetro, readCandidates, promoteCandidateById } from "../engine/retro.js";
import { promoteEpic } from "../engine/promote.js";
import { createStory, markStoryDone, findStory, buildStoriesFile, formatStory } from "../stories/stories.js";
import { syncAgentSymlinks, agentsDir } from "../agents/generate.js";
import { resolveConfigV4 } from "../config/resolve.js";
import type { AgentResponse } from "../../types/output.js";
import type { ObjectiveState, ObjectiveStep } from "../../types/state.js";
import type { TwistedSettings, TwistedConfigV4 } from "../../types/config.js";
import type { NoteType } from "../../types/notes.js";
import type { ArtifactType } from "../../types/commands.js";
import type { EpicType } from "../../types/epic.js";
import { join } from "path";

const ARTIFACT_TYPES: ArtifactType[] = ["research", "scope", "plan", "changelog"];

const argv = process.argv.slice(2);
const command = parseArgs(argv);
const root = findRoot(process.cwd());
const rawSettings = readSettings(root);
const config = resolveConfig(rawSettings as TwistedSettings);
// v4 config (lazy — only used by v4 commands)
const configV4: TwistedConfigV4 = resolveConfigV4(rawSettings as TwistedSettings);

function respond(response: AgentResponse): void {
  output(response, command.flags.agent);
}

function findActiveObjective(): { dir: string; state: ObjectiveState } | null {
  const objectives = findObjectives(root);
  if (command.flags.objective) {
    const match = objectives.find((o) => o.objective === command.flags.objective);
    if (!match) return null;
    return { dir: match.dir, state: readState(match.dir) };
  }
  // Most recently updated in-progress, then todo
  const active = objectives
    .filter((o) => o.lane !== "done")
    .map((o) => ({ ...o, state: readState(o.dir) }))
    .sort((a, b) => b.state.updated.localeCompare(a.state.updated));
  if (active.length === 0) return null;
  return { dir: active[0]!.dir, state: active[0]!.state };
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
      // v3 lanes
      ensureDir(join(twisted, "todo"));
      ensureDir(join(twisted, "in-progress"));
      ensureDir(join(twisted, "done"));
      ensureDir(join(twisted, "worktrees"));
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
      if (!rawSettings || Object.keys(rawSettings).length === 0) {
        writeSettings(root, { $schema: "./schemas/settings.schema.json" });
      }
      respond({ status: "ok", command: "init", display: "Initialized .twisted/", config });
      break;
    }

    case "open": {
      const objective = (command.params as Record<string, unknown>).objective as string | undefined;
      if (!objective) {
        respond({ status: "error", command: "open", error: "Objective name required: tx open <name>" });
        break;
      }
      const objDir = objectiveDir(root, "todo", objective);
      ensureDir(objDir);
      ensureDir(join(objDir, "research"));
      ensureDir(join(objDir, "sessions"));
      const state = createInitialState(objective, config.pipeline);
      writeState(objDir, state);
      writeNotes(objDir, []);
      writeTasks(objDir, []);
      respond({ status: "ok", command: "open", state, display: `Opened objective: ${objective}\nStep: research` });
      break;
    }

    case "status": {
      const objectives = findObjectives(root);
      if (objectives.length === 0) {
        respond({ status: "ok", command: "status", display: "No objectives." });
        break;
      }
      const targetName = (command.params as Record<string, unknown>).objective as string | undefined;
      if (targetName) {
        const match = objectives.find((o) => o.objective === targetName);
        if (!match) {
          respond({ status: "error", command: "status", error: `Objective '${targetName}' not found` });
          break;
        }
        const state = readState(match.dir);
        respond({ status: "ok", command: "status", state, display: formatStatusDetail(state) });
      } else {
        const lines = objectives.map((o) => {
          const s = readState(o.dir);
          return `${s.objective}  ${s.status}  ${s.step}  ${s.tasks_done}/${s.tasks_total ?? "?"}  ${s.updated}`;
        });
        respond({ status: "ok", command: "status", display: lines.join("\n") });
      }
      break;
    }

    case "next": {
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "next", error: "No active objective. Run: tx open <name>" });
        break;
      }
      const next = nextStep(active.state.step, config.pipeline);
      if (!next) {
        respond({ status: "ok", command: "next", state: active.state, action: { type: "done" }, display: "All steps complete." });
        break;
      }
      // Advance state
      const newState = advanceState(active.state, config.pipeline);
      writeState(active.dir, newState);
      respond({ status: "ok", command: "next", state: newState, display: `Advanced to: ${next}` });
      break;
    }

    case "write": {
      const params = command.params as Record<string, unknown>;
      const type = params.type as string;
      const number = params.number as number | undefined;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "write", error: "No active objective" });
        break;
      }
      if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
        respond({ status: "error", command: "write", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
        break;
      }
      const artifactPath = resolveArtifactPath(active.dir, type as ArtifactType, number);
      const resolvedPath = artifactPath === "CHANGELOG.md" ? join(root, artifactPath) : artifactPath;
      const content = await readStdin();
      writeArtifact(resolvedPath, content);
      respond({ status: "ok", command: "write", display: `Wrote ${type} to ${artifactPath}` });
      break;
    }

    case "read": {
      const params = command.params as Record<string, unknown>;
      const type = params.type as string;
      const number = params.number as number | undefined;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "read", error: "No active objective" });
        break;
      }
      if (!ARTIFACT_TYPES.includes(type as ArtifactType)) {
        respond({ status: "error", command: "read", error: `Unknown artifact type: "${type}". Valid: ${ARTIFACT_TYPES.join(", ")}` });
        break;
      }
      const artifactPath = resolveArtifactPath(active.dir, type as ArtifactType, number);
      const fullPath = artifactPath === "CHANGELOG.md" ? join(root, artifactPath) : artifactPath;
      try {
        const content = readArtifact(fullPath);
        if (command.flags.agent) {
          respond({ status: "ok", command: "read", display: content });
        } else {
          process.stdout.write(content);
        }
      } catch {
        respond({ status: "error", command: "read", error: `Artifact not found: ${fullPath}` });
      }
      break;
    }

    case "note": {
      const params = command.params as Record<string, unknown>;
      const summary = params.summary as string;
      const type = params.type as string | undefined;
      const reason = params.reason as string | undefined;
      const impact = params.impact as string | undefined;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "note", error: "No active objective" });
        break;
      }
      const notes = readNotes(active.dir);
      const note = addNote(notes, {
        type: (type as NoteType | undefined) ?? "note",
        step: active.state.step,
        summary,
        reason,
        impact,
      });
      writeNotes(active.dir, notes);
      // Update active session if exists
      const session = readActiveSession(active.dir);
      if (session) {
        addSessionEvent(session, { type: "note_added", noteId: note.id });
        writeActiveSession(active.dir, session);
      }
      respond({ status: "ok", command: "note", display: `Note #${note.id}: ${summary}` });
      break;
    }

    case "notes": {
      const params = command.params as Record<string, unknown>;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "notes", error: "No active objective" });
        break;
      }
      const notes = readNotes(active.dir);
      const noteType = params.type as string | undefined;
      const noteStep = params.step as string | undefined;
      const filtered = filterNotes(notes, { type: noteType as NoteType | undefined, step: noteStep as ObjectiveStep | undefined });
      const display = filtered.map((n) => `#${n.id} [${n.type}] (${n.step}) ${n.summary}`).join("\n");
      respond({ status: "ok", command: "notes", display: display || "No notes." });
      break;
    }

    case "tasks": {
      const params = command.params as Record<string, unknown>;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "tasks", error: "No active objective" });
        break;
      }
      const tasks = readTasks(active.dir);
      const action = params.action as string | undefined;
      const id = params.id as number | undefined;
      const summary = params.summary as string | undefined;
      const done = params.done as boolean | undefined;
      const group = params.group as number | undefined;

      if (!action) {
        const display = tasks.map((t) => `#${t.id} [${t.done ? "x" : " "}] (g${t.group ?? "?"}) ${t.summary}`).join("\n");
        respond({ status: "ok", command: "tasks", display: display || "No tasks." });
        break;
      }
      if (action === "add") {
        const task = addTask(tasks, { summary: summary! });
        writeTasks(active.dir, tasks);
        respond({ status: "ok", command: "tasks", display: `Task #${task.id}: ${summary}` });
      } else if (action === "update") {
        const task = updateTask(tasks, id!, { done });
        writeTasks(active.dir, tasks);
        respond({ status: "ok", command: "tasks", display: `Updated task #${task.id}` });
      } else if (action === "assign") {
        const task = assignTask(tasks, id!, group!);
        writeTasks(active.dir, tasks);
        respond({ status: "ok", command: "tasks", display: `Assigned task #${task.id} to group ${group}` });
      } else if (action === "show") {
        const task = getTask(tasks, id!);
        respond({ status: "ok", command: "tasks", display: JSON.stringify(task, null, 2) });
      }
      break;
    }

    case "pickup": {
      const params = command.params as Record<string, unknown>;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "pickup", error: "No active objective" });
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
      const latest = getLatestSession(sessions);
      const nextNumber = (latest?.number ?? 0) + 1;
      const name = params.name as string | null ?? null;
      const sess = createSession(active.state.step, name, nextNumber);
      writeActiveSession(active.dir, sess);
      respond({
        status: "ok",
        command: "pickup",
        session: { active: sess, previous: latest },
        display: `Session #${nextNumber} started${name ? ` (${name})` : ""}`,
      });
      break;
    }

    case "handoff": {
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "handoff", error: "No active objective" });
        break;
      }
      const session = readActiveSession(active.dir);
      if (!session) {
        respond({ status: "error", command: "handoff", error: "No active session" });
        break;
      }
      const summary = closeSession(session);
      respond({
        status: "handoff",
        command: "handoff",
        session: { active: session, previous: null },
        action: {
          type: "prompt_user",
          prompt: `Write a session summary for session #${summary.number}. Include: what was accomplished, decisions made, artifacts created, and what comes next. Pipe the result to: tx session save ${summary.name} -a`,
        },
        display: `Ending session #${summary.number}. Write summary and run: tx session save ${summary.name}`,
      });
      break;
    }

    case "session": {
      const params = command.params as Record<string, unknown>;
      const action = params.action as string | undefined;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "session", error: "No active objective" });
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
        const nameOverride = params.name as string | undefined;
        if (nameOverride) sess.name = nameOverride;
        const summary = closeSession(sess);
        const content = await readStdin();
        const sessionsDir = join(active.dir, "sessions");
        ensureDir(sessionsDir);
        writeArtifact(join(sessionsDir, summary.file), content);
        deleteActiveSession(active.dir);
        respond({ status: "ok", command: "session", display: `Session saved: sessions/${summary.file}` });
      } else if (action === "list") {
        const sessions = listSessions(active.dir);
        const display = sessions.map((s) => `#${s.number} ${s.name} (${s.file})`).join("\n");
        respond({ status: "ok", command: "session", display: display || "No sessions." });
      }
      break;
    }

    case "close": {
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "close", error: "No active objective" });
        break;
      }
      const qaCfg = config.pipeline.qa;
      const shipCfg = config.pipeline.ship;

      // Aggregate retro notes if notes exist (v4-aware)
      let retroSummary = "";
      try {
        const { retroMd, candidates } = writeRetro(active.dir, active.state.objective);
        if (candidates.length > 0) {
          retroSummary = `\n  Backlog candidates: ${candidates.length} (run: tx backlog)`;
        }
      } catch {
        // Non-fatal — retro is best-effort
      }

      respond({
        status: "handoff",
        command: "close",
        state: active.state,
        action: {
          type: "prompt_user",
          prompt: `Objective "${active.state.objective}" is ready to close.\n\nSub-steps:\n1. QA (provider: ${qaCfg.provider})\n2. Write changelog entry → pipe to: tx write changelog -a\n3. Ship (provider: ${shipCfg.provider})\n\nComplete these steps, then run: tx next -a to finalize.`,
        },
        display: `Close: ${active.state.objective}\n  QA: ${qaCfg.provider}\n  Ship: ${shipCfg.provider}${retroSummary}`,
      });
      break;
    }

    case "resume": {
      const params = command.params as Record<string, unknown>;
      const objectiveName = params.objective as string | undefined;
      if (!objectiveName) {
        respond({ status: "error", command: "resume", error: "Objective name required: tx resume <name>" });
        break;
      }
      const objectives = findObjectives(root);
      const match = objectives.find((o) => o.objective === objectiveName);
      if (!match) {
        respond({ status: "error", command: "resume", error: `Objective '${objectiveName}' not found` });
        break;
      }
      const state = readState(match.dir);
      const session = readActiveSession(match.dir);
      const sessions = listSessions(match.dir);
      const latest = getLatestSession(sessions);
      respond({
        status: "ok",
        command: "resume",
        state,
        session: { active: session, previous: latest },
        display: `Resuming: ${objectiveName}\n  Step: ${state.step}\n  Status: ${state.status}`,
      });
      break;
    }

    case "research":
    case "scope":
    case "plan":
    case "build": {
      const stepName = command.subcommand;
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: stepName, error: "No active objective" });
        break;
      }
      if (active.state.step !== stepName) {
        respond({
          status: "error",
          command: stepName,
          error: `Objective is at step "${active.state.step}", not "${stepName}"`,
          state: active.state,
        });
        break;
      }
      const providerCfg = stepName === "research" ? config.pipeline.research : null;
      const provider = providerCfg?.provider ?? "built-in";
      if (provider && provider !== "built-in" && provider !== "skip") {
        respond({
          status: "handoff",
          command: stepName,
          state: active.state,
          action: { type: "invoke_skill", skill: provider },
          display: `Step: ${stepName}\n  Provider: ${provider}`,
        });
      } else {
        respond({
          status: "handoff",
          command: stepName,
          state: active.state,
          action: { type: "prompt_user", prompt: `Execute the ${stepName} step for objective "${active.state.objective}".` },
          display: `Step: ${stepName} (built-in)`,
        });
      }
      break;
    }

    case "config": {
      respond({ status: "ok", command: "config", config, display: JSON.stringify(config, null, 2) });
      break;
    }

    case "artifacts": {
      const active = findActiveObjective();
      if (!active) {
        respond({ status: "error", command: "artifacts", error: "No active objective" });
        break;
      }
      const { dir, files } = listObjectiveFiles(active.dir);
      const artifacts = listArtifacts(dir, files);
      const display = artifacts.map((a) => `${a.exists ? "+" : "-"} ${a.type}: ${a.path}`).join("\n");
      respond({ status: "ok", command: "artifacts", display });
      break;
    }

    case "stories": {
      const p = command.params as Record<string, unknown>;
      const epicName = p.epic as string | undefined ?? command.flags.epic ?? command.flags.objective;
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
        const lines = [formatStory(story), "", "Acceptance:", ...story.acceptance.map((a) => `  - ${a}`)];
        respond({ status: "ok", command: "stories", display: lines.join("\n") });

      } else {
        // List stories
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
      const epicName = p.epic as string | undefined ?? command.flags.epic ?? command.flags.objective;
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
      const epicName = p.epic as string | undefined ?? command.flags.epic ?? command.flags.objective;
      const targetType = p.type as EpicType | undefined;
      if (!epicName || !targetType) {
        respond({ status: "error", command: "promote", error: "Usage: tx promote <epic> --type <feature|bug|chore|release>" });
        break;
      }
      try {
        const result = promoteEpic(root, epicName, targetType, configV4);
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
        // Find the candidate across all done/archive epics
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
      // List all candidates
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
        ?? command.flags.epic ?? command.flags.objective;
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
      const newDir = location.dir.replace("0-backlog", "1-ready");
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
        ?? command.flags.epic ?? command.flags.objective;
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
      const newDir = location.dir.replace(location.lane, "5-archive");
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
        respond({ status: "ok", command: "version", display: `twisted-workflow v${configV4.version}` });
      } else if (command.flags.help) {
        respond({ status: "ok", command: "help", display: getHelpText() });
      } else {
        const objectives = findObjectives(root);
        if (objectives.length === 0) {
          respond({ status: "ok", command: "interactive", display: "No objectives. Run: tx open <name>" });
        } else {
          const lines = objectives.map((o) => {
            const s = readState(o.dir);
            return `${s.objective}  ${s.status}  ${s.step}`;
          });
          respond({ status: "ok", command: "interactive", display: lines.join("\n") });
        }
      }
    }
  }
}

function formatStatusDetail(state: ObjectiveState): string {
  const stepsDone = state.steps_completed.length;
  const stepsTotal = state.steps_completed.length + state.steps_remaining.length + 1;
  return config.strings.status_detail
    .replace("{objective}", state.objective)
    .replace("{status}", state.status)
    .replace("{step}", state.step)
    .replace("{steps_done}", String(stepsDone))
    .replace("{steps_total}", String(stepsTotal))
    .replace("{tasks_done}", String(state.tasks_done))
    .replace("{tasks_total}", String(state.tasks_total ?? "?"))
    .replace("{created}", state.created)
    .replace("{updated}", state.updated);
}

function getHelpText(): string {
  return `tx <command> [args] [flags]

Lifecycle:
  tx init                    Setup .twisted/
  tx open <objective>        Create objective
  tx close [objective]       Final step
  tx next [objective]        Advance step
  tx resume <objective>      Resume objective
  tx status [objective]      Show status

Steps:
  tx research [objective]    Run research
  tx scope [objective]       Run scope
  tx plan [objective]        Run plan
  tx build [objective]       Run build

Session:
  tx pickup [name]           Start session
  tx handoff [name]          End session
  tx session status|save|list

Artifacts:
  tx write <type> [obj]      Write (stdin)
  tx read <type> [obj]       Read (stdout)
  tx artifacts [obj]         List artifacts

Tasks:
  tx tasks [obj]             List tasks
  tx tasks add <summary>     Add task
  tx tasks update <id>       Update task
  tx tasks show <id>         Show detail

Notes:
  tx note <summary>          Add note (--note|--decide|--defer|--discover|--blocker)
  tx notes [obj]             Query notes

Config:
  tx config [section] [sub]  Show config

Flags:
  -a, --agent       JSON output
  -y, --yolo        Skip confirmations
  -o, --objective   Target objective
  -h, --help        Show help
  -v, --version     Show version`;
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
