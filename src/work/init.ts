/**
 * Init flow — first-time setup.
 */

import type { TwistedConfig } from "../../types/config.js";
import { resolveConfig } from "../config/resolve.js";
import { defaults } from "../config/defaults.js";

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
