import type { SkillDefinition } from "../../lib/skill.js";

export const twistedWork: SkillDefinition = {
  frontmatter: {
    name: "twisted-work",
    description:
      "Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands",
    "user-invocable": true,
    "argument-hint":
      '[init | status [objective] | next [objective] | resume {objective} | scope | decompose | execute | review | ship | config [section] [subsection]] [--yolo]',
  },
  content: `\
**REQUIRED:** Load the \`using-twisted-workflow\` skill for shared config, defaults, presets, string templates, and constraints. All section references below point to that skill.

# /twisted-work

You are the orchestrator for the twisted-workflow pipeline. You are the only user-facing skill. You route to internal sub-skills (twisted-scope, twisted-decompose, twisted-execute) based on arguments and objective state.

## On Every Invocation

1. Load \`using-twisted-workflow\` if not already loaded.
2. Read and merge config per **Three-Layer Config Resolution**.
3. Inject any \`context_skills\` from merged config.
4. Check \`writing.skill\` availability per **Writing Quality**.
5. Parse command arguments into a \`ParsedCommand\`: subcommand, params, and flags.

## Argument Routing

Parse the first argument and route:

| Subcommand | Action |
|---|---|
| \`init\` | Run **Init Flow** |
| \`status\` | Run **Status Flow** |
| \`status {objective}\` | Run **Status Detail Flow** |
| \`next\` | Run **Next Flow** |
| \`next {objective}\` | Run **Next Flow** for named objective |
| \`resume {objective}\` | Run **Resume Flow** |
| \`scope\` | Run **Step Flow** for scope |
| \`decompose\` | Run **Step Flow** for decompose |
| \`execute\` | Run **Step Flow** for execute |
| \`review\` | Run **Step Flow** for review delegation |
| \`ship\` | Run **Step Flow** for ship delegation |
| \`config\` | Run **Config Flow** |
| \`config {section}\` | Run **Config Flow** with section drill-down |
| \`config {section} {subsection}\` | Run **Config Flow** with subsection drill-down |
| *(none)* | Run **Interactive Flow** |

All subcommands accept \`--yolo\` per **Yolo Mode**.

---

## Init Flow

1. Create \`.twisted/\` directory structure per **Directory Structure**.
2. Apply **Gitignore Rules**.
3. Run **Tool Detection** — scan for gstack, Superpowers, Nimbalyst skills.
4. Suggest a preset array based on detected tools per **Tool Detection**.
5. Ask user to confirm or change the suggested presets. Explain that the first preset has priority — put the most important one first.
6. If \`settings.json\` exists:
   - Load and merge with **Built-in Defaults** using **Three-Layer Config Resolution**.
   - Show merged result with each value labelled \`(custom)\`, \`(default)\`, or \`(preset: name)\`.
   - Ask if the user wants to update anything.
   - Write back only customized keys — never a full snapshot.
7. If \`settings.json\` does not exist:
   - Show the merged result (defaults + selected presets).
   - Ask if the user wants to override any values.
   - Write \`presets\` and any customized keys to \`settings.json\`.
   - Commit using \`strings.commit_messages.init\`.

---

## Status Flow

1. Scan all lanes per **Directory Structure** (or scan flat directories if \`state.use_folders\` is false).
2. For each objective, read \`state.md\` frontmatter to get \`ObjectiveState\`.
3. Display using \`strings.status_line\` template:
   \`\`\`
   {objective}  {status}  {step}  {progress}  {updated}
   \`\`\`
4. If a specific objective is named, show detailed view using \`strings.status_detail\` template.
5. Exit — do not invoke any sub-skill.

---

## Next Flow

1. If no objective named: find the most recently updated objective across \`todo\` and \`in-progress\` lanes (by \`updated\` timestamp in \`state.md\` frontmatter).
2. Read \`state.md\` to get current \`ObjectiveState\`.
3. Determine the **next** step from **Pipeline Step Sequence**, skipping delegatable steps with \`provider: "skip"\`.
4. Check **Auto-Advance Logic** pause conditions:
   - If the next step has different phase settings: show \`strings.phase_recommendation\` and wait for confirmation (unless \`--yolo\`).
   - If context is low: suggest new session and pause (unless \`--yolo\`).
5. Update \`state.md\` frontmatter to the new step.
6. Route to the appropriate handler:
   - \`research\`, \`scope\` → load \`twisted-scope\` sub-skill
   - \`arch_review\` → delegate to configured provider per **Provider Delegation**
   - \`decompose\` → load \`twisted-decompose\` sub-skill
   - \`execute\` → load \`twisted-execute\` sub-skill
   - \`code_review\`, \`qa\`, \`ship\` → delegate to configured provider per **Provider Delegation**
7. After the step completes, check if more steps remain. If auto-advance is enabled and no pause conditions trigger, loop back to step 3.

---

## Resume Flow

1. Find the named objective across all lanes by reading \`state.md\` files.
2. Read \`state.md\` to get current \`ObjectiveState\`.
3. Resume at the **current** step (not next) — the step that was in progress when the previous session ended.
4. Check pause conditions per **Auto-Advance Logic** (unless \`--yolo\`).
5. Route to the appropriate handler (same routing as **Next Flow** step 6).
6. After the step completes, continue with auto-advance (same as **Next Flow** step 7).

---

## Step Flow

For explicit step subcommands (\`scope\`, \`decompose\`, \`execute\`, \`review\`, \`ship\`):

1. Find the active objective (most recently updated in \`todo\` or \`in-progress\`).
2. Read \`state.md\` to get current \`ObjectiveState\`.
3. Map the subcommand to a pipeline step:
   - \`scope\` → the scope step (loads \`twisted-scope\`)
   - \`decompose\` → the decompose step (loads \`twisted-decompose\`)
   - \`execute\` → the execute step (loads \`twisted-execute\`)
   - \`review\` → the code_review step (delegates to configured provider)
   - \`ship\` → the ship step (delegates to configured provider)
4. Update \`state.md\` to that step.
5. Execute the step.
6. After completion, continue with auto-advance per **Auto-Advance Logic**.

---

## Config Flow

Hierarchical drill-down into the resolved configuration. Each level:
1. Shows current values for that section.
2. Explains what each setting does.
3. Offers to modify any value.
4. Validates changes against the type schema.
5. Writes only changed keys to \`settings.json\` (sparse override).

### No section specified — full overview

Show all top-level config sections with a one-line summary of current state:

\`\`\`
twisted-workflow config (v2.0, preset: {preset})

  tools       — detected: {list of detected tools}
  pipeline    — providers for research, arch_review, code_review, qa, ship
  execution   — strategy: {strategy}, tiers: {tiers}, parallel: {parallel}
  phases      — model/effort/context/mode per core step
  decompose   — estimation: {scale}, thresholds: {batch}/{split}
  templates   — issue fields, changelog format
  writing     — skill: {skill}, fallback: {fallback}
  state       — folders: {use_folders}
  flow        — auto-advance: {auto}, pause conditions

Which section would you like to configure?
\`\`\`

### Section drill-down

For each \`ConfigSection\`, show all fields with current values and available options:

**Example: \`/twisted-work config execution\`**
\`\`\`
Execution Configuration:
  strategy:         task-tool    (options: task-tool, agent-teams, manual, auto)
  discipline:       null         (e.g., superpowers:test-driven-development)
  worktree_tiers:   2            (options: 1, 2, 3)
  group_parallel:   true         (run independent groups concurrently)
  merge_strategy:   normal       (options: normal, squash, rebase)
  review_frequency: after-all    (options: per-group, risk-based, after-all)
  test_requirement: must-pass    (options: must-pass, best-effort, deferred)

Which setting would you like to change?
\`\`\`

### Pipeline subsection drill-down

**Example: \`/twisted-work config pipeline research\`**
\`\`\`
Pipeline — research:
  provider:  built-in    (current)
  fallback:  built-in    (if primary unavailable)
  options:   {}

Available providers: built-in, skip, ask, gstack:/office-hours, nimbalyst:deep-researcher
\`\`\`

---

## Interactive Flow

1. Scan all lanes for existing objectives.
2. Show status table using \`strings.status_line\` template.
3. If objectives exist: ask to resume an existing objective or start new.
4. If resume: run **Resume Flow** for the chosen objective.
5. If new or no objectives: follow **Objective Naming** from \`using-twisted-workflow\`, then start at the first pipeline step (research or scope, depending on pipeline config).
6. Route to the appropriate sub-skill.

---

## Provider Delegation

When a delegatable step runs:

1. Look up the provider in \`pipeline.{phase}.provider\`.
2. If \`"skip"\`: mark step complete, advance to next.
3. If \`"ask"\`: show available providers, ask user to choose.
4. If \`"built-in"\`: use twisted-workflow's implementation.
5. If \`"gstack:/{command}"\`: invoke the gstack slash command.
6. If \`"superpowers:{skill}"\`: invoke the Superpowers skill.
7. If \`"nimbalyst:{skill}"\`: invoke the Nimbalyst skill.
8. If the provider is unavailable: try \`pipeline.{phase}.fallback\`.
9. If both unavailable: report the error and pause.
10. After delegation completes: update \`state.md\` with the provider used in \`tools_used\`.

---

## State Management

On every state change:

1. Update \`state.md\` frontmatter atomically (all fields at once).
2. If \`state.use_folders\` is true and \`status\` changed: move the objective folder to the appropriate lane directory per **Kanban Transitions**.
3. Commit folder moves using \`strings.commit_messages.lane_move\`.

---

## Constraints

- Follow all **Shared Constraints** from \`using-twisted-workflow\`.
- This is the only user-facing skill — all user interaction enters here.
- Sub-skills (twisted-scope, twisted-decompose, twisted-execute) are internal — never tell the user to invoke them directly.
- All human-facing text uses string templates from the resolved config.
- If no \`.twisted/settings.json\` found, note: "No .twisted/settings.json found, using defaults. Run /twisted-work init to configure."`,
};
