import type { SkillDefinition } from "../lib/skill.js";

const TX_COMMANDS = `
IMPORTANT: Run all commands using the \`tx\` binary (globally installed via npm link). Do NOT run \`node dist/cli.js\` or attempt to execute files directly — use \`tx\` as the command.

When communicating with the user, refer to commands using the skill syntax \`/tx <command>\` (e.g. \`/tx next\`, \`/tx issue open\`) — not the raw \`tx\` CLI form. The user invokes this as a skill, not a shell command.

## Using the tx CLI

All tx operations go through \`tx\` commands. Use \`-a\` (\`--agent\`) for JSON output when working programmatically.

### Issues

An issue is a unit of work (feature, bug, spike, chore, or release). Each issue follows a workflow with steps like research, build, etc.

\`\`\`bash
tx issue open <slug> [--type <type>]       # Create issue (feature | bug | spike | chore | release)
tx issue close <slug>                       # Close issue
tx issue status [slug]                      # Show issues (all or specific)
\`\`\`

### Workflow Navigation

Steps within a workflow advance automatically when artifacts are complete. Use \`/tx next\` to manually advance.

\`\`\`bash
tx next [slug]                              # Advance issue to the next step
\`\`\`

### Cycles

Group issues into timeboxes (sprints). An issue can belong to multiple cycles.

\`\`\`bash
tx cycle start <slug>                       # Start a new cycle
tx cycle pull [slug]                        # Pull issue(s) into the active cycle
tx cycle close                              # Close active cycle with retro
\`\`\`

### Sessions & Checkpoints

Track work sessions and create checkpoints for handoffs.

\`\`\`bash
tx pickup [name]                            # Start a session
tx checkpoint [summary]                     # Create a checkpoint (handoff marker)
tx config                                   # Show configuration
\`\`\`

### Artifacts

Read and write step artifacts (markdown, json, etc).

\`\`\`bash
echo "content" | tx write <type> [slug]    # Write artifact (type: research, scope, plan, etc)
tx read <type> [slug]                       # Read artifact
\`\`\`

### Notes

Capture decisions, discoveries, blockers, and retrospective observations.

\`\`\`bash
tx note "summary"                                   # Add plain note
tx note "summary" --decide                         # Mark as decision
tx note "summary" --defer                          # Mark as deferral
tx note "summary" --discover                       # Mark as discovery
tx note "summary" --blocker                        # Mark as blocker
tx note "summary" --retro                          # Mark as retrospective
\`\`\`

### Flags

\`\`\`bash
-a, --agent       # JSON output (AgentResponse)
-y, --yolo        # Skip confirmations
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
  issue?: IssueState;
  config?: TwistedConfig;
  error?: string;
  session?: SessionData;
}

interface IssueState {
  issue: string;        // issue slug
  type: "feature" | "bug" | "spike" | "chore" | "release";
  workflow_id: string;  // workflow identifier
  step: string;         // current step name (e.g. "research", "build")
  status: "open" | "blocked" | "done" | "archived";
  tasks_done: number;
  tasks_total: number | null;
  created: string;      // ISO 8601
  updated: string;      // ISO 8601
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
- \`"invoke_skill"\` — load and execute the skill at the given path (look for \`SKILL.md\` inside the directory). The \`prompt\` field describes the step context to carry in.
- \`"confirm"\` — display message, run next_command to proceed
- \`"done"\` — workflow step complete
- \`"prompt_user"\` — execute the step described in \`prompt\`
- \`"run_agents"\` — spawn agents for the listed assignments

**Skill dispatch — step handoffs:**

When a step command returns \`invoke_skill\`, follow this sequence:

1. If \`context_skills\` is present, load each listed skill as context before proceeding.
2. Load and execute the skill at \`action.skill\` (read its \`SKILL.md\`).
3. After the skill writes its artifact, call \`tx next\` to advance the workflow.

**Configuring step skills** (in \`.twisted/settings.json\`):

\`\`\`jsonc
{
  // Override the primary skill for any step:
  "step_skills": {
    "build": "@mattpocock/skills/tdd",
    "research": ""  // empty string disables the default
  },
  // Override the review skill for any step:
  "step_review_skills": {
    "plan": ""  // empty string disables review
  },
  // Inject skills as context before every step:
  "context_skills": ["@mattpocock/skills/tdd"],
  // Skill packages installed via tx install:
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  }
}
\`\`\`
`;

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "tx",
    description: "Orchestrator for the tx pipeline — issue-driven workflow with cycles, sessions, and data-driven steps",
    "user-invocable": true,
    "argument-hint": "[issue open <slug> | issue close <slug> | issue status | next [slug] | cycle start <slug> | cycle pull [slug] | cycle close | pickup [name] | checkpoint | write <type> [slug] | read <type> [slug] | note | config] [-a] [-y]",
  },
  content: TX_COMMANDS,
};
