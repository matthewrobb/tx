// src/cli/commands/install.ts — `tx install [package]` command.
//
// Installs skill/persona/config packages declared in .twisted/settings.json
// dependencies (or a specific package passed as an argument). Runs locally —
// no daemon needed. Uses NpmPackageResolver to install into
// ~/.twisted/projects/{projectId}/node_modules/.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createNpmResolver } from '../../adapters/npm/resolver.js';
import { getProjectId } from '../../adapters/socket/paths.js';
/**
 * Read dependencies from .twisted/settings.json.
 * Returns an empty record if the file doesn't exist or has no dependencies.
 */
async function loadDependencies(cwd) {
    const settingsPath = join(cwd, '.twisted', 'settings.json');
    try {
        const raw = await readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        return settings.dependencies ?? {};
    }
    catch {
        return {};
    }
}
export function registerInstallCommand(program, opts) {
    // tx install [package] [--force]
    program
        .command('install [package]')
        .description('Install skill/persona packages from dependencies or by name')
        .option('-f, --force', 'Delete and re-install packages from scratch')
        .action(async (packageArg, cmdOpts) => {
        const cwd = process.cwd();
        const projectId = getProjectId(cwd);
        const resolver = createNpmResolver();
        const force = cmdOpts.force ?? false;
        // Determine what to install.
        let packages;
        if (packageArg !== undefined) {
            // Single package from CLI argument.
            packages = { [packageArg]: packageArg };
        }
        else {
            // All dependencies from settings.json.
            packages = await loadDependencies(cwd);
            if (Object.keys(packages).length === 0) {
                const msg = 'No dependencies in .twisted/settings.json. Pass a package name: tx install <package>';
                if (opts.agent) {
                    console.log(JSON.stringify({ status: 'error', command: 'install', error: msg }));
                }
                else {
                    console.log(msg);
                }
                return;
            }
        }
        const results = [];
        const installed = [];
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
                }
                else {
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
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                results.push({ name, version: spec, status: 'error', error });
                if (!opts.agent) {
                    console.error(`  ✗ ${name}: ${error}`);
                }
            }
        }
        // Build the list of discovered skill files for agent analysis.
        const skillFiles = [];
        for (const pkg of installed) {
            for (const skill of pkg.manifest.skills ?? []) {
                skillFiles.push({
                    package: pkg.name,
                    skill,
                    path: join(pkg.installPath, skill, 'SKILL.md'),
                });
            }
        }
        if (opts.agent) {
            const response = {
                status: results.every((r) => r.status === 'ok') ? 'ok' : 'error',
                command: 'install',
                display: results.map((r) => r.status === 'ok' ? `${r.name}@${r.version}` : `${r.name}: ${r.error}`).join('\n'),
                data: results,
            };
            // If skills were installed, return an action for the agent to analyze them.
            if (skillFiles.length > 0) {
                response.action = {
                    type: 'prompt_user',
                    prompt: buildAnalysisPrompt(skillFiles),
                };
            }
            console.log(JSON.stringify(response));
        }
        else if (skillFiles.length > 0) {
            console.log(`\n  ${skillFiles.length} skills discovered — run with -a for agent-driven manifest analysis.`);
        }
    });
    // tx uninstall <package>
    program
        .command('uninstall <package>')
        .description('Remove an installed skill/persona package')
        .action(async (packageName) => {
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
        }
        else {
            console.log(`  ✓ Removed ${packageName}`);
        }
    });
}
// ── Prompt builder ───────────────────────────────────────────────────────
function buildAnalysisPrompt(skillFiles) {
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
        }
      }
    }
  }
}
\`\`\`

Only include entries in \`detected_outputs\` and \`suggested_overrides\` when you actually find matching instructions in the skill. Skills with no external outputs should have empty arrays.

Use \`tx manifest show\` to verify the result.`;
}
//# sourceMappingURL=install.js.map