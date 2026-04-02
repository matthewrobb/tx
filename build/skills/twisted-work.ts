import type { SkillDefinition } from "../lib/skill.js";

const TX_COMMANDS = `
IMPORTANT: Run all commands using the \`tx\` binary (globally installed via npm link). Do NOT run \`node dist/cli.js\` or attempt to execute files directly — use \`tx\` as the command.

When communicating with the user, refer to commands using the skill syntax \`/tx <command>\` (e.g. \`/tx next\`, \`/tx open\`) — not the raw \`tx\` CLI form. The user invokes this as a skill, not a shell command.

## Using the tx CLI

All twisted-workflow operations go through \`tx\` commands. Use \`-a\` (\`--agent\`) for JSON output when working programmatically.

### Lifecycle

\`\`\`bash
tx init                              # Setup .twisted/ and .claude/agents/
tx open <epic> [--type <type>]       # Create epic (feature | bug | spike | chore | release)
tx ready <epic>                      # Move from 0-backlog → 1-ready
tx next [epic]                       # Advance active epic one step
tx close [epic]                      # Final close step (retro + ship)
tx resume <epic>                     # Resume epic at current step
tx status [epic]                     # Show all epics or detail for one
tx archive <epic> [--reason <text>]  # Move to 5-archive
\`\`\`

### Lane Pipeline

Epics move through lanes based on their type. Default for \`feature\`:

\`\`\`
0-backlog → 1-ready → 2-active → 4-done
\`\`\`

Within \`2-active\`, steps advance when artifacts are written:

\`\`\`
research → scope → plan → decompose → build
\`\`\`

### Steps

\`\`\`bash
tx research [epic]     # Run research step
tx scope [epic]        # Run scope step
tx plan [epic]         # Run plan step
tx build [epic]        # Run build step
\`\`\`

### Estimation & Promotion

\`\`\`bash
tx estimate <epic> --size <XS|S|M|L|XL> --rationale <text> [--timebox <P2D>] [--confidence 1-5]
tx promote <epic> --type <feature|bug|chore|release>   # Promote spike to another type
\`\`\`

### Stories

\`\`\`bash
tx stories <epic>                  # List stories
tx stories <epic> add <summary>    # Add a story
tx stories <epic> done <S-001>     # Mark story done
tx stories <epic> show <S-001>     # Show story detail
\`\`\`

### Backlog

\`\`\`bash
tx backlog                         # List backlog candidates from retros
tx backlog promote <BC-001>        # Promote a retro candidate
\`\`\`

### Sessions

\`\`\`bash
tx pickup [name]           # Start a session
tx handoff                 # End session (prompts for summary)
tx session status          # Show active session
tx session save            # Save session summary (pipe from stdin)
tx session list            # List all sessions
\`\`\`

### Artifacts

\`\`\`bash
echo "content" | tx write scope [epic]    # Write scope artifact
echo "content" | tx write research [epic] # Write research artifact
tx read scope [epic]                      # Read scope artifact
tx artifacts [epic]                       # List epic artifacts
\`\`\`

### Tasks

\`\`\`bash
tx tasks [epic]                  # List tasks
tx tasks add "summary"           # Add a task (T-001 format)
tx tasks update <T-001> --done   # Mark task done
tx tasks show <T-001>            # Show task detail
\`\`\`

### Notes

\`\`\`bash
tx note "summary"                               # Add plain note
tx note "summary" --decide --reason "because"   # Decision
tx note "summary" --defer                       # Deferral
tx note "summary" --discover                    # Discovery
tx note "summary" --blocker                     # Blocker
tx note "summary" --retro                       # Retrospective note
tx notes [epic]                                 # List notes
\`\`\`

### Flags

\`\`\`bash
-a, --agent       # JSON output (AgentResponse)
-y, --yolo        # Skip confirmations
-e, --epic        # Target a specific epic
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
  epic?: CoreState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}

interface CoreState {
  epic: string;
  type: "feature" | "bug" | "spike" | "chore" | "release";
  lane: string;       // "0-backlog" | "1-ready" | "2-active" | "3-review" | "4-done" | "5-archive"
  step: string;       // current step within the lane
  status: "active" | "blocked" | "done";
  tasks_done: number;
  tasks_total: number | null;
  created: string;
  updated: string;
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
    name: "tx",
    description: "Orchestrator for the twisted-workflow pipeline — artifact-driven epic lifecycle across 6 lanes with sessions, stories, estimation, and retro",
    "user-invocable": true,
    "argument-hint": "[init | open <epic> [--type] | ready | next | close | status | resume | archive | estimate | promote | stories | backlog | pickup | handoff | session | write | read | tasks | note | notes | artifacts | config] [-e <epic>] [-a] [-y]",
  },
  content: TX_COMMANDS,
};
