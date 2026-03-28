/**
 * Config display — hierarchical drill-down for /twisted-work config.
 */

import type { TwistedConfig } from "../../types/config.js";
import type { ConfigSection, ConfigParams } from "../../types/commands.js";

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
