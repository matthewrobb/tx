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
    program
        .command('install [package]')
        .description('Install skill/persona packages from dependencies or by name')
        .action(async (packageArg) => {
        const cwd = process.cwd();
        const projectId = getProjectId(cwd);
        const resolver = createNpmResolver();
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
        for (const [name, spec] of Object.entries(packages)) {
            // For dependencies, the spec is the version/URL to install.
            // For a CLI argument, name and spec are the same string.
            const installSpec = name === spec ? name : `${name}@${spec}`;
            try {
                const resolved = await resolver.install(installSpec, projectId);
                results.push({ name: resolved.name, version: resolved.version, status: 'ok' });
                if (!opts.agent) {
                    console.log(`  ✓ ${resolved.name}@${resolved.version}`);
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
        if (opts.agent) {
            console.log(JSON.stringify({
                status: results.every((r) => r.status === 'ok') ? 'ok' : 'error',
                command: 'install',
                display: results.map((r) => r.status === 'ok' ? `${r.name}@${r.version}` : `${r.name}: ${r.error}`).join('\n'),
                data: results,
            }));
        }
    });
}
//# sourceMappingURL=install.js.map