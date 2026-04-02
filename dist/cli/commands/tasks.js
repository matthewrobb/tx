import { locateEpic, readCoreState, readTasks, writeTasks } from "../fs.js";
export function registerTasksCommands(program, ctx) {
    const { root, respond } = ctx;
    // ─── tasks ─────────────────────────────────────────────────────────────────
    const tasksCmd = program
        .command("tasks")
        .description("List tasks")
        .argument("[epic]", "epic name")
        .action((epicArg) => {
        const globalEpic = program.opts().epic;
        const epicNameParam = epicArg ?? globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "tasks", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "tasks", error: "No active epic" });
                return;
            }
        }
        const tasks = readTasks(active.dir);
        const display = tasks.map((t) => `#${t.id} [${t.done ? "x" : " "}] ${t.summary}${t.group ? ` (${t.group})` : ""}`).join("\n");
        respond({ status: "ok", command: "tasks", display: display || "No tasks." });
    });
    tasksCmd
        .command("add")
        .description("Add a task")
        .argument("<summary>", "task summary")
        .action((summary, _opts, cmd) => {
        const globalEpic = program.opts().epic;
        // tasks add doesn't take an epic positional — use the active epic or global flag
        const epicNameParam = globalEpic;
        let active;
        if (epicNameParam) {
            const location = locateEpic(root, epicNameParam);
            if (!location) {
                respond({ status: "error", command: "tasks", error: `Epic '${epicNameParam}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: epicNameParam, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "tasks", error: "No active epic" });
                return;
            }
        }
        void cmd;
        const tasks = readTasks(active.dir);
        const maxId = tasks.reduce((max, t) => {
            const n = parseInt(t.id.replace("T-", ""), 10);
            return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const newTask = {
            id: `T-${String(maxId + 1).padStart(3, "0")}`,
            summary,
            done: false,
            group: null,
        };
        tasks.push(newTask);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        writeTasks(active.dir, tasks);
        ctx.ensureSession(active.dir, active.state.step);
        ctx.logAction(active.dir, { type: "task", summary: `Added ${newTask.id}: ${summary}`, timestamp: new Date().toISOString() });
        respond({ status: "ok", command: "tasks", display: `Task ${newTask.id}: ${summary}` });
    });
    tasksCmd
        .command("update")
        .description("Update a task")
        .argument("<id>", "task ID (T-xxx)")
        .option("--done", "mark task done")
        .option("--undone", "mark task not done")
        .option("--group <group>", "assign to group")
        .action((id, opts, cmd) => {
        const globalEpic = program.opts().epic;
        let active;
        if (globalEpic) {
            const location = locateEpic(root, globalEpic);
            if (!location) {
                respond({ status: "error", command: "tasks", error: `Epic '${globalEpic}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: globalEpic, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "tasks", error: "No active epic" });
                return;
            }
        }
        void cmd;
        const tasks = readTasks(active.dir);
        const task = tasks.find((t) => t.id === id || t.id === String(id));
        if (!task) {
            respond({ status: "error", command: "tasks", error: `Task not found: ${id}` });
            return;
        }
        if (opts.done)
            task.done = true;
        else if (opts.undone)
            task.done = false;
        if (opts.group !== undefined)
            task.group = opts.group;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        writeTasks(active.dir, tasks);
        ctx.ensureSession(active.dir, active.state.step);
        ctx.logAction(active.dir, { type: "task", summary: `Updated ${task.id}${opts.done ? " → done" : ""}`, timestamp: new Date().toISOString() });
        respond({ status: "ok", command: "tasks", display: `Updated task ${task.id}` });
    });
    tasksCmd
        .command("show")
        .description("Show task detail")
        .argument("<id>", "task ID (T-xxx)")
        .action((id, _opts, cmd) => {
        const globalEpic = program.opts().epic;
        let active;
        if (globalEpic) {
            const location = locateEpic(root, globalEpic);
            if (!location) {
                respond({ status: "error", command: "tasks", error: `Epic '${globalEpic}' not found` });
                return;
            }
            const state = readCoreState(location.dir);
            active = { dir: location.dir, epicName: globalEpic, state };
        }
        else {
            active = ctx.findActiveEpic();
            if (!active) {
                respond({ status: "error", command: "tasks", error: "No active epic" });
                return;
            }
        }
        void cmd;
        const tasks = readTasks(active.dir);
        const task = tasks.find((t) => t.id === id || t.id === String(id));
        if (!task) {
            respond({ status: "error", command: "tasks", error: `Task not found: ${id}` });
            return;
        }
        respond({ status: "ok", command: "tasks", display: JSON.stringify(task, null, 2) });
    });
}
//# sourceMappingURL=tasks.js.map