// src/cli/commands/tasks.ts
import { Command } from "commander";
import { locateEpic, readCoreState, readTasks, writeTasks } from "../fs.js";
import type { Task } from "../../types/index.js";
import type { CliContext } from "../context.js";

export function registerTasksCommands(program: Command, ctx: CliContext): void {
  const { root, respond } = ctx;

  // ─── tasks ─────────────────────────────────────────────────────────────────

  const tasksCmd = program
    .command("tasks")
    .description("List tasks")
    .argument("[epic]", "epic name")
    .action((epicArg: string | undefined) => {
      const globalEpic = program.opts().epic as string | undefined;
      const epicNameParam = epicArg ?? globalEpic;
      let active: ReturnType<typeof ctx.findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "tasks", error: `Epic '${epicNameParam}' not found` });
          return;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = ctx.findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "tasks", error: "No active epic" });
          return;
        }
      }
      const tasks = readTasks(active.dir) as unknown as Task[];
      const display = tasks.map((t) => `#${t.id} [${t.done ? "x" : " "}] ${t.summary}${t.group ? ` (${t.group})` : ""}`).join("\n");
      respond({ status: "ok", command: "tasks", display: display || "No tasks." });
    });

  tasksCmd
    .command("add")
    .description("Add a task")
    .argument("<summary>", "task summary")
    .action((summary: string, _opts, cmd) => {
      const globalEpic = program.opts().epic as string | undefined;
      // tasks add doesn't take an epic positional — use the active epic or global flag
      const epicNameParam = globalEpic;
      let active: ReturnType<typeof ctx.findActiveEpic>;
      if (epicNameParam) {
        const location = locateEpic(root, epicNameParam);
        if (!location) {
          respond({ status: "error", command: "tasks", error: `Epic '${epicNameParam}' not found` });
          return;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: epicNameParam, state };
      } else {
        active = ctx.findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "tasks", error: "No active epic" });
          return;
        }
      }
      void cmd;
      const tasks = readTasks(active.dir) as unknown as Task[];
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
    });

  tasksCmd
    .command("update")
    .description("Update a task")
    .argument("<id>", "task ID (T-xxx)")
    .option("--done", "mark task done")
    .option("--undone", "mark task not done")
    .option("--group <group>", "assign to group")
    .action((id: string, opts: { done?: boolean; undone?: boolean; group?: string }, cmd) => {
      const globalEpic = program.opts().epic as string | undefined;
      let active: ReturnType<typeof ctx.findActiveEpic>;
      if (globalEpic) {
        const location = locateEpic(root, globalEpic);
        if (!location) {
          respond({ status: "error", command: "tasks", error: `Epic '${globalEpic}' not found` });
          return;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: globalEpic, state };
      } else {
        active = ctx.findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "tasks", error: "No active epic" });
          return;
        }
      }
      void cmd;
      const tasks = readTasks(active.dir) as unknown as Task[];
      const task = tasks.find((t) => t.id === id || t.id === String(id));
      if (!task) {
        respond({ status: "error", command: "tasks", error: `Task not found: ${id}` });
        return;
      }
      if (opts.done) task.done = true;
      else if (opts.undone) task.done = false;
      if (opts.group !== undefined) task.group = opts.group;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeTasks(active.dir, tasks as any);
      respond({ status: "ok", command: "tasks", display: `Updated task ${task.id}` });
    });

  tasksCmd
    .command("show")
    .description("Show task detail")
    .argument("<id>", "task ID (T-xxx)")
    .action((id: string, _opts, cmd) => {
      const globalEpic = program.opts().epic as string | undefined;
      let active: ReturnType<typeof ctx.findActiveEpic>;
      if (globalEpic) {
        const location = locateEpic(root, globalEpic);
        if (!location) {
          respond({ status: "error", command: "tasks", error: `Epic '${globalEpic}' not found` });
          return;
        }
        const state = readCoreState(location.dir);
        active = { dir: location.dir, epicName: globalEpic, state };
      } else {
        active = ctx.findActiveEpic();
        if (!active) {
          respond({ status: "error", command: "tasks", error: "No active epic" });
          return;
        }
      }
      void cmd;
      const tasks = readTasks(active.dir) as unknown as Task[];
      const task = tasks.find((t) => t.id === id || t.id === String(id));
      if (!task) {
        respond({ status: "error", command: "tasks", error: `Task not found: ${id}` });
        return;
      }
      respond({ status: "ok", command: "tasks", display: JSON.stringify(task, null, 2) });
    });
}
