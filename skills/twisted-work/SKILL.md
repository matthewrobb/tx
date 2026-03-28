---
name: twisted-work
description: Orchestrator for the twisted-workflow pipeline — state-driven router with init, status, config, next, resume, and step subcommands
user-invocable: true
argument-hint: [init | status [objective] | next [objective] | resume {objective} | scope | decompose | execute | review | ship | config [section] [subsection]] [--yolo]
---

**Read first:** These source files contain shared functions referenced below:
- `src/config/resolve.ts`
- `src/pipeline/routing.ts`
- `src/state/machine.ts`

# /twisted-work

The only user-facing skill. Routes to internal sub-skills based on arguments and objective state.

---

## Command Routing

```typescript
/**
 * Parse user input into a structured command.
 *
 * Examples:
 *   /twisted-work                         → { subcommand: undefined }
 *   /twisted-work status my-feature       → { subcommand: "status", params: { objective: "my-feature" } }
 *   /twisted-work next --yolo             → { subcommand: "next", flags: { yolo: true } }
 *   /twisted-work config pipeline research → { subcommand: "config", params: { section: "pipeline", subsection: "research" } }
 */
export function parseCommand(rawArgs: string): ParsedCommand {
  const args = rawArgs.trim().split(/\s+/);
  const flags = { yolo: args.includes("--yolo") };
  const filtered = args.filter(a => a !== "--yolo");

  const subcommand = filtered[0] as TwistedSubcommand | undefined;
  const rest = filtered.slice(1);

  switch (subcommand) {
    case "status":
      return { subcommand, params: { objective: rest[0] }, flags, raw_args: rawArgs };
    case "next":
      return { subcommand, params: { objective: rest[0] }, flags, raw_args: rawArgs };
    case "resume":
      return { subcommand, params: { objective: rest[0]! }, flags, raw_args: rawArgs };
    case "config":
      return { subcommand, params: { section: rest[0], subsection: rest[1] }, flags, raw_args: rawArgs };
    default:
      return { subcommand, params: {}, flags, raw_args: rawArgs };
  }
}
```

```typescript
/**
 * Route a parsed command to the correct handler.
 *
 * Subcommand mapping:
 *   init      → setup .twisted/, detect tools, select presets, write $schema
 *   status    → scan lanes, read state.md frontmatter, display
 *   next      → find active objective, advance to next step
 *   resume    → find named objective, resume at current step
 *   scope     → load twisted-scope sub-skill
 *   decompose → load twisted-decompose sub-skill
 *   execute   → load twisted-execute sub-skill
 *   review    → delegate to pipeline.code_review.provider
 *   ship      → delegate to pipeline.ship.provider
 *   config    → show/edit config with hierarchical drill-down
 *   (none)    → interactive mode: scan, show status, ask resume or new
 */
export function routeCommand(
  command: ParsedCommand,
  config: TwistedConfig,
): void {
  switch (command.subcommand) {
    case "init":
      executeInit(config, command.flags.yolo);
      return;
    case "status":
      executeStatus(config, command.params);
      return;
    case "next":
      executeNext(config, command.params, command.flags.yolo);
      return;
    case "resume":
      executeResume(config, command.params, command.flags.yolo);
      return;
    case "scope":
    case "decompose":
    case "execute":
    case "review":
    case "ship":
      executeStep(config, command.subcommand, command.flags.yolo);
      return;
    case "config":
      executeConfig(config, command.params);
      return;
    default:
      executeInteractive(config, command.flags.yolo);
      return;
  }
}
```

---

## Init Flow

```typescript
/**
 * Execute /twisted-work init.
 *
 * Steps:
 *   1. Create .twisted/ directory structure
 *   2. Add .twisted/worktrees/ to .gitignore (if git repo)
 *   3. Tool Detection: scan for installed tools (gstack, superpowers, nimbalyst skills)
 *   4. Suggest preset array based on detected tools (most important first):
 *        gstack + superpowers + nimbalyst → ["nimbalyst", "superpowers", "gstack"]
 *        gstack + superpowers             → ["superpowers", "gstack"]
 *        gstack only                      → ["gstack"]
 *        superpowers only                 → ["superpowers"]
 *        nothing detected                 → []
 *   5. Ask user to confirm or change — first preset has priority
 *   6. If settings.json exists: show merged config, offer to update
 *      Label each value: (default), (preset: name), or (custom)
 *   7. If settings.json does not exist:
 *        Write { "$schema": "path/to/schemas/settings.schema.json", "presets": [...] }
 *        Include only presets + any user-chosen overrides (sparse)
 *        Commit using config.strings.commit_messages.init
 */
export function executeInit(
  config: TwistedConfig,
  yolo: boolean,
): void {
  createDirectoryStructure(config);
  addGitignoreEntry(config.directories.worktrees);

  const detected = detectTools();
  // Record: { gstack: boolean, superpowers: boolean, nimbalyst_skills: boolean }
  const suggestedPresets = suggestPresets(detected);

  if (!yolo) {
    display("Detected tools: " + formatDetected(detected));
    display("Suggested presets: " + JSON.stringify(suggestedPresets));
    display("First preset has priority — put the most important one first.");
    // Wait for confirmation or changes
  }

  const settings = existsSync(config.files.settings)
    ? readSettings(config.files.settings)
    : { presets: suggestedPresets };

  const resolved = resolveConfig(settings);
  displayMergedConfig(resolved);

  // Write settings.json with $schema for VS Code autocomplete
  writeSettings(config.files.settings, {
    $schema: schemaRelativePath(config.files.settings),
    ...sparseOnly(settings),
  });

  commitInit(config);
}
```

---

## Next / Resume / Auto-Advance

```typescript
/**
 * Execute /twisted-work next — advance to the next step.
 *
 * 1. Find the most recently updated objective (or use named objective)
 * 2. Read state.md to get current ObjectiveState
 * 3. Determine next step, skipping delegatable steps with provider: "skip"
 * 4. Check pause conditions (unless --yolo):
 *      - config.flow.auto_advance === false → always pause
 *      - config.flow.pause_on_config_change → pause if next step has different model/effort/context/mode
 *      - config.flow.pause_on_low_context → pause if context window is high
 * 5. Show phase recommendation if pausing:
 *      config.strings.phase_recommendation with {step}, {model}, {effort}, {context}, {mode}
 * 6. Load the sub-skill for the next step:
 *      research, scope → twisted-scope
 *      arch_review     → delegate to pipeline provider
 *      decompose       → twisted-decompose
 *      execute         → twisted-execute
 *      code_review, qa, ship → delegate to pipeline provider
 * 7. After step completes, loop back (auto-advance) unless paused
 */
export function executeNext(
  config: TwistedConfig,
  state: ObjectiveState,
  yolo: boolean,
): void {
  let currentState = state;

  while (true) {
    const next = nextStep(currentState.step, config.pipeline);
    if (!next) break; // all steps complete

    // Check pause conditions
    const pauseReason = shouldPause(
      currentState.step,
      next,
      config.flow,
      config.phases,
      yolo,
    );

    if (pauseReason) {
      // Show phase recommendation
      const settings = getPhaseSettings(next, config.phases);
      if (settings) {
        const rec = config.strings.phase_recommendation
          .replace("{step}", next)
          .replace("{model}", settings.model)
          .replace("{effort}", settings.effort)
          .replace("{context}", settings.context)
          .replace("{mode}", settings.mode);
        display(rec);
      }

      if (pauseReason === "config_change") {
        display("Settings change — confirm before continuing.");
      } else if (pauseReason === "low_context") {
        display("Context window is high — consider a new session.");
      } else if (pauseReason === "user_requested") {
        display("Auto-advance disabled — confirm to continue.");
      }

      // Wait for user confirmation (unless yolo, which shouldn't reach here)
      waitForConfirmation();
    }

    // Dispatch to appropriate handler
    currentState = dispatchStep(config, currentState, next, yolo);

    // If auto-advance is off and not yolo, pause after each step
    if (!config.flow.auto_advance && !yolo) break;
  }
}
```

```typescript
/**
 * Execute /twisted-work resume — resume at the CURRENT step (not next).
 */
export function executeResume(
  config: TwistedConfig,
  state: ObjectiveState,
  yolo: boolean,
): void {
  // Resume at the current step — the one that was in progress when the session ended
  dispatchStep(config, state, state.step, yolo);

  // Then continue with auto-advance
  executeNext(config, state, yolo);
}
```

---

## Config Display

```typescript
/**
 * Execute /twisted-work config — show and edit configuration.
 *
 * Each drill-down level:
 *   1. Show current values for that section
 *   2. Explain what each setting does (from descriptions in the schema)
 *   3. Offer to modify any value
 *   4. Validate changes against the JSON Schema
 *   5. Write only changed keys to settings.json (sparse override)
 *
 * Sections: tools, pipeline, execution, phases, decompose,
 *           templates, writing, state, flow, tracking
 */
export function executeConfig(
  config: TwistedConfig,
  params: ConfigParams,
): void {
  if (!params.section) {
    // Full overview
    displayConfigOverview(config);
    return;
  }

  if (params.subsection) {
    // Deep drill-down (e.g. "pipeline research")
    displaySubsection(config, params.section, params.subsection);
    return;
  }

  // Section drill-down
  displaySection(config, params.section);
}
```

```typescript
/**
 * Show full config overview.
 *
 * twisted-workflow config (v2.0, presets: [...])
 *
 *   tracking    — strategies: [...]
 *   tools       — detected: ...
 *   pipeline    — providers for research, arch_review, code_review, qa, ship
 *   execution   — strategy: ..., tiers: ..., parallel: ...
 *   phases      — model/effort/context/mode per core step
 *   decompose   — estimation: ..., thresholds: .../...
 *   templates   — issue fields, changelog format
 *   writing     — skill: ..., fallback: ...
 *   state       — folders: ...
 *   flow        — auto-advance: ..., pause conditions
 *
 * Which section would you like to configure?
 */
export function displayConfigOverview(config: TwistedConfig): void {
  display(`twisted-workflow config (v${config.version}, presets: ${JSON.stringify(config.presets)})`);
  display(`  tracking    — ${JSON.stringify(config.tracking)}`);
  display(`  tools       — detected: ${formatDetected(config.tools.detected)}`);
  display(`  pipeline    — ${formatPipelineSummary(config.pipeline)}`);
  display(`  execution   — strategy: ${config.execution.strategy}, tiers: ${config.execution.worktree_tiers}`);
  display(`  phases      — scope: ${formatPhase(config.phases.scope)}, decompose: ${formatPhase(config.phases.decompose)}, execute: ${formatPhase(config.phases.execute)}`);
  display(`  decompose   — estimation: ${config.decompose.estimation}, thresholds: ${config.decompose.batch_threshold}/${config.decompose.split_threshold}`);
  display(`  writing     — skill: ${config.writing.skill}, fallback: ${config.writing.fallback}`);
  display(`  state       — folders: ${config.state.use_folders}`);
  display(`  flow        — auto-advance: ${config.flow.auto_advance}`);
}
```

