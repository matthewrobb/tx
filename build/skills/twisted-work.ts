import type { SkillDefinition } from "../lib/skill.js";

const TX_COMMANDS = `
## Using the tx CLI

All twisted-workflow operations go through \`tx\` commands. Use \`-a\` (\`--agent\`) for JSON output when working programmatically.

### Lifecycle

\`\`\`bash
tx init                    # Setup .twisted/ (run once)
tx open <objective>        # Create a new objective
tx close [objective]       # Final pipeline step (QA + ship)
tx status [objective]      # Show all objectives or detail for one
tx next [objective]        # Advance to next pipeline step
tx resume <objective>      # Resume an objective at current step
\`\`\`

### Pipeline Steps

\`\`\`bash
tx research [objective]    # Run research step
tx scope [objective]       # Run scope step
tx plan [objective]        # Run plan step
tx build [objective]       # Run build step
\`\`\`

5-step pipeline: **research → scope → plan → build → close**

### Sessions

\`\`\`bash
tx pickup [name]           # Start a session
tx handoff [name]          # End session (prompts for summary)
tx session status          # Show active session
tx session save <name>     # Save session markdown (pipe from stdin)
tx session list            # List all sessions
\`\`\`

### Artifacts

\`\`\`bash
echo "content" | tx write scope      # Write scope artifact (stdin)
echo "content" | tx write research   # Write research artifact
tx read scope                        # Read scope artifact (stdout)
tx artifacts                         # List all artifacts
\`\`\`

### Tasks

\`\`\`bash
tx tasks                   # List all tasks
tx tasks add "summary"     # Add a task
tx tasks update <id> --done  # Mark task done
tx tasks show <id>         # Show task detail
\`\`\`

### Notes

\`\`\`bash
tx note "summary"          # Add plain note
tx note "summary" --decide --reason "because"   # Decision
tx note "summary" --defer  # Deferral
tx note "summary" --discover  # Discovery
tx note "summary" --blocker   # Blocker
tx notes                   # List all notes
\`\`\`

### Flags

\`\`\`bash
-a, --agent       # JSON output (AgentResponse)
-y, --yolo        # Skip confirmations
-o, --objective   # Target specific objective
-h, --help        # Show help
-v, --version     # Show version
\`\`\`

## AgentResponse

Every \`tx\` command with \`-a\` returns JSON:

\`\`\`ts
interface AgentResponse {
  status: "ok" | "error" | "paused" | "handoff";
  command: string;
  action?: AgentAction;
  display?: string;
  state?: ObjectiveState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}

type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "confirm"; message: string; next_command: string }
  | { type: "done" }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | { type: "run_agents"; agents: AgentAssignment[] }
  | { type: "install_cli"; instructions: string };
\`\`\`

**Handling status values:**
- \`"ok"\` — command succeeded, use \`display\` for output
- \`"error"\` — command failed, read \`error\` field
- \`"paused"\` — needs confirmation, run \`action.next_command\`
- \`"handoff"\` — agent action required, execute \`action\`

**Handling action types:**
- \`"invoke_skill"\` — load the named skill
- \`"confirm"\` — display message, run next_command to proceed
- \`"done"\` — pipeline complete
- \`"prompt_user"\` — execute the step described in \`prompt\`
- \`"run_agents"\` — spawn agents for the listed assignments
`;

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "twisted-work",
    description: "Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands",
    "user-invocable": true,
    "argument-hint": "[init | open | close | status [objective] | next [objective] | resume {objective} | research | scope | plan | build | pickup | handoff | session | write | read | tasks | note | notes | artifacts | config [section]] [--yolo] [-a]",
  },
  content: TX_COMMANDS,
};
