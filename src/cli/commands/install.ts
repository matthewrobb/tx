// src/cli/commands/install.ts — `tx install [package]` command.
//
// Installs skill/persona/config packages declared in .twisted/settings.json
// dependencies (or a specific package passed as an argument). Runs locally —
// no daemon needed. Uses NpmPackageResolver to install into
// ~/.twisted/projects/{projectId}/node_modules/.

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createNpmResolver } from '../../adapters/npm/resolver.js';
import { getProjectId } from '../../adapters/socket/paths.js';
import { printError } from '../output.js';
import { filterUnboundSkills } from './install-filter.js';
import type { ResolvedPackage } from '../../ports/packages.js';

export interface GlobalOpts {
  agent: boolean;
  yolo: boolean;
}

/**
 * Read dependencies from .twisted/settings.json.
 * Returns an empty record if the file doesn't exist or has no dependencies.
 */
async function loadDependencies(cwd: string): Promise<Record<string, string>> {
  const settingsPath = join(cwd, '.twisted', 'settings.json');
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as { dependencies?: Record<string, string> };
    return settings.dependencies ?? {};
  } catch {
    return {};
  }
}

export function registerInstallCommand(program: Command, opts: GlobalOpts): void {
  // tx install [package] [--force]
  program
    .command('install [package]')
    .description('Install skill/persona packages from dependencies or by name')
    .option('-f, --force', 'Delete and re-install packages from scratch')
    .action(async (packageArg: string | undefined, cmdOpts: { force?: boolean }) => {
      const cwd = process.cwd();
      const projectId = getProjectId(cwd);
      const resolver = createNpmResolver();
      const force = cmdOpts.force ?? false;

      // Determine what to install.
      let packages: Record<string, string>;
      if (packageArg !== undefined) {
        // Single package from CLI argument.
        packages = { [packageArg]: packageArg };
      } else {
        // All dependencies from settings.json.
        packages = await loadDependencies(cwd);
        if (Object.keys(packages).length === 0) {
          const msg = 'No dependencies in .twisted/settings.json. Pass a package name: tx install <package>';
          if (opts.agent) {
            console.log(JSON.stringify({ status: 'error', command: 'install', error: msg }));
          } else {
            console.log(msg);
          }
          return;
        }
      }

      const results: Array<{ name: string; version: string; status: 'ok' | 'error'; error?: string }> = [];
      const installed: ResolvedPackage[] = [];

      for (const [name, spec] of Object.entries(packages)) {
        try {
          // Force: delete existing package first.
          if (force) {
            await resolver.removePackage(name, projectId);
            await resolver.removeManifestEntry(name, projectId);
          }

          let resolved;
          if (spec.startsWith('github:')) {
            const repoUrl = `https://github.com/${spec.slice('github:'.length)}.git`;
            resolved = await resolver.installGit(name, repoUrl, projectId);
          } else {
            const installSpec = name === spec ? name : `${name}@${spec}`;
            resolved = await resolver.install(installSpec, projectId);
          }
          results.push({ name: resolved.name, version: resolved.version, status: 'ok' });
          installed.push(resolved);
          if (!opts.agent) {
            const skills = resolved.manifest.skills ?? [];
            const skillInfo = skills.length > 0 ? ` (${skills.length} skills: ${skills.join(', ')})` : '';
            console.log(`  ✓ ${resolved.name}@${resolved.version}${skillInfo}`);
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          results.push({ name, version: spec, status: 'error', error });
          if (!opts.agent) {
            console.error(`  ✗ ${name}: ${error}`);
          }
        }
      }

      // Build the list of discovered skill files for agent analysis.
      const allSkillFiles: Array<{ package: string; skill: string; path: string }> = [];
      for (const pkg of installed) {
        for (const skill of pkg.manifest.skills ?? []) {
          allSkillFiles.push({
            package: pkg.name,
            skill,
            path: join(pkg.installPath, skill, 'SKILL.md'),
          });
        }
      }

      // Load existing manifest to filter out already-analyzed skills.
      const manifestPath = join(resolver.getBaseDir(), projectId, 'skill-manifest.json');
      let existingManifest: Record<string, unknown> = {};
      try {
        existingManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      } catch {
        // No manifest yet — all skills need analysis.
      }

      // Skills needing manifest analysis (no entry or no overrides yet).
      const needsAnalysis = filterUnboundSkills(allSkillFiles, existingManifest);
      // Skills needing step-binding suggestions (entry exists but binding is null).
      const needsBinding = filterUnboundSkills(allSkillFiles, existingManifest);

      if (opts.agent) {
        const response: Record<string, unknown> = {
          status: results.every((r) => r.status === 'ok') ? 'ok' : 'error',
          command: 'install',
          display: results.map((r) =>
            r.status === 'ok' ? `${r.name}@${r.version}` : `${r.name}: ${r.error}`,
          ).join('\n'),
          data: results,
        };

        if (needsAnalysis.length > 0) {
          response.action = {
            type: 'prompt_user',
            prompt: buildAnalysisPrompt(needsAnalysis),
          };
        } else if (allSkillFiles.length > 0) {
          // All skills already analyzed — no action needed.
          response.display += `\n\nAll ${allSkillFiles.length} skills already have manifest entries.`;
        }

        console.log(JSON.stringify(response));
      } else if (needsAnalysis.length > 0) {
        console.log(`\n  ${needsAnalysis.length} skills need analysis — run with -a for agent-driven manifest.`);
      } else if (allSkillFiles.length > 0) {
        console.log(`\n  All ${allSkillFiles.length} skills already analyzed. Use tx skills to view.`);
      }
    });

  // tx uninstall <package>
  program
    .command('uninstall <package>')
    .description('Remove an installed skill/persona package')
    .action(async (packageName: string) => {
      const cwd = process.cwd();
      const projectId = getProjectId(cwd);
      const resolver = createNpmResolver();

      await resolver.removePackage(packageName, projectId);
      await resolver.removeManifestEntry(packageName, projectId);

      if (opts.agent) {
        console.log(JSON.stringify({
          status: 'ok',
          command: 'uninstall',
          display: `Removed ${packageName}`,
          data: { name: packageName },
        }));
      } else {
        console.log(`  ✓ Removed ${packageName}`);
      }
    });
}

// ── Prompt builder ───────────────────────────────────────────────────────

function buildAnalysisPrompt(
  skillFiles: Array<{ package: string; skill: string; path: string }>,
): string {
  const fileList = skillFiles
    .map((s) => `- **${s.package}/${s.skill}**: \`${s.path}\``)
    .join('\n');

  return `Analyze the following installed skills and write a skill manifest.

## Installed Skills

${fileList}

## Instructions

For each skill, read its SKILL.md file and analyze:

1. **Description**: A one-line summary of what the skill does.
2. **Detected outputs**: What external side effects does the skill instruct the agent to produce? Look for instructions to:
   - Create GitHub issues or file bugs
   - Open pull requests or submit PRs
   - Write files to specific paths on disk
   - Make git commits or push branches
   - Send Slack/Discord/email messages
   - Call external APIs or webhooks
   - Any other action that produces output outside the conversation
3. **Suggested overrides**: For each detected output, generate an override that redirects the output through the twisted-workflow pipeline:
   - GitHub issues → "Do NOT create GitHub issues. Instead, use \`tx issue\` to create issues in the backlog."
   - Pull requests → "Do NOT create pull requests. The workflow handles commits and PRs."
   - File writes → "Do NOT write files directly. Use \`tx write <artifact-name>\` to write artifacts."
   - Git commits/push → "Do NOT commit or push. The workflow manages git operations."
   - Slack/email → "Do NOT send messages to external services. Use \`tx note\` to record findings."
   - If a specific step number contains the output instruction, include it in \`omit\` so the agent knows to skip that step.

## Output

Construct the manifest as JSON using this schema, then pipe it to \`tx manifest write\`:

\`\`\`bash
echo '<manifest JSON>' | tx manifest write
\`\`\`

Schema:

\`\`\`json
{
  "<package-name>": {
    "version": "<version>",
    "discovered": "<ISO 8601 timestamp>",
    "skills": {
      "<skill-name>": {
        "path": "<relative path to SKILL.md>",
        "description": "<one-line summary>",
        "detected_outputs": ["github-issue", "pull-request", "file-write", "git-commit", "git-push", "slack-message", "api-call"],
        "suggested_overrides": {
          "omit": ["Step 7", "Step 10"],
          "directives": [
            "Do NOT create GitHub issues. Instead, use \`tx issue\` to create issues in the backlog.",
            "Write all outputs as artifacts via \`tx write <type>\`. Do NOT write files directly."
          ]
        },
        "suggested_step_binding": null
      }
    }
  }
}
\`\`\`

Set \`suggested_step_binding\` to \`null\` for all skills initially. After the user picks bindings in Step 2, update the manifest with the chosen binding:

\`\`\`json
"suggested_step_binding": { "step": "build", "type": "step_skills" }
\`\`\`

Valid types: \`"step_skills"\`, \`"step_review_skills"\`, \`"context_skills"\`. Set to \`{ "step": "none", "type": "skip" }\` if the user explicitly declines a binding. This prevents re-prompting on future installs.

Only include entries in \`detected_outputs\` and \`suggested_overrides\` when you actually find matching instructions in the skill. Skills with no external outputs should have empty arrays.

Use \`tx manifest show\` to verify the result.

## Step 2: Suggest Step-Skill Bindings

After writing the manifest, suggest which skills to bind to which workflow steps. Consider the current workflow (run \`tx config show\` to see steps) and match skills by purpose:

- Research/exploration skills → \`research\` step
- PRD/scoping skills → \`scope\` step
- Planning/architecture skills → \`plan\` step
- TDD/implementation skills → \`build\` step
- Review/grilling skills → \`step_review_skills\` for the appropriate step

Skills can also come from Claude Code plugin registries (e.g. \`plugin-name:skill-name\`). Include those if they're relevant to the workflow.

Present 2-3 options to the user as numbered choices. After the user picks, write the config via:

\`\`\`bash
echo '{"step_skills":{"build":"@pkg/tdd","scope":"@pkg/write-a-prd"},"step_review_skills":{"plan":"@pkg/grill-me"}}' | tx config merge
\`\`\`

This deep-merges into \`.twisted/settings.json\` without clobbering existing settings.`;
}
