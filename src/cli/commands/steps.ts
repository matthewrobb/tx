// src/cli/commands/steps.ts
import { Command } from "commander";
import { locateEpic, readCoreState } from "../fs.js";
import type { CliContext } from "../context.js";

export function registerStepsCommands(program: Command, ctx: CliContext): void {
  const { root, respond } = ctx;

  // ─── research / scope / plan / decompose / build ───────────────────────────

  for (const stepName of ["research", "scope", "plan", "decompose", "build"] as const) {
    program
      .command(stepName)
      .description(`Run ${stepName} step`)
      .argument("[epic]", "epic name")
      .action((epicArg: string | undefined) => {
        const globalEpic = program.opts().epic as string | undefined;
        const epicNameParam = epicArg ?? globalEpic;
        let active: ReturnType<typeof ctx.findActiveEpic>;
        if (epicNameParam) {
          const location = locateEpic(root, epicNameParam);
          if (!location) {
            respond({ status: "error", command: stepName, error: `Epic '${epicNameParam}' not found` });
            return;
          }
          const state = readCoreState(location.dir);
          active = { dir: location.dir, epicName: epicNameParam, state };
        } else {
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

        const cfg = ctx.config;
        const skill = cfg.step_skills[stepName];
        const reviewSkill = cfg.step_review_skills[stepName];
        const contextSkills = cfg.context_skills.length > 0 ? cfg.context_skills : undefined;

        if (skill) {
          respond({
            status: "handoff",
            command: stepName,
            epic: active.state,
            action: {
              type: "invoke_skill",
              skill,
              prompt: `Execute the ${stepName} step for epic "${active.epicName}".`,
            },
            review_skill: reviewSkill || undefined,
            context_skills: contextSkills,
            display: `Step: ${stepName} (epic: ${active.epicName})`,
          });
        } else {
          respond({
            status: "handoff",
            command: stepName,
            epic: active.state,
            action: {
              type: "prompt_user",
              prompt: `Execute the ${stepName} step for epic "${active.epicName}".`,
            },
            context_skills: contextSkills,
            display: `Step: ${stepName} (epic: ${active.epicName})`,
          });
        }
      });
  }
}
