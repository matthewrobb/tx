import { locateEpic, readCoreState } from "../fs.js";
export function registerStepsCommands(program, ctx) {
    const { root, respond } = ctx;
    // ─── research / scope / plan / build ───────────────────────────────────────
    for (const stepName of ["research", "scope", "plan", "build"]) {
        program
            .command(stepName)
            .description(`Run ${stepName} step`)
            .argument("[epic]", "epic name")
            .action((epicArg) => {
            const globalEpic = program.opts().epic;
            const epicNameParam = epicArg ?? globalEpic;
            let active;
            if (epicNameParam) {
                const location = locateEpic(root, epicNameParam);
                if (!location) {
                    respond({ status: "error", command: stepName, error: `Epic '${epicNameParam}' not found` });
                    return;
                }
                const state = readCoreState(location.dir);
                active = { dir: location.dir, epicName: epicNameParam, state };
            }
            else {
                active = ctx.findActiveEpic();
                if (!active) {
                    respond({ status: "error", command: stepName, error: "No active epic" });
                    return;
                }
            }
            if (active.state.step !== stepName) {
                respond({
                    status: "error",
                    command: stepName,
                    error: `Epic is at step "${active.state.step}", not "${stepName}"`,
                    epic: active.state,
                });
                return;
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
        });
    }
}
//# sourceMappingURL=steps.js.map