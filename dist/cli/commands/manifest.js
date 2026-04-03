// src/cli/commands/manifest.ts — `tx manifest write` and `tx manifest show`.
//
// Manages the skill manifest file at ~/.twisted/projects/{id}/skill-manifest.json.
// Local command — no daemon needed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createNpmResolver } from '../../adapters/npm/resolver.js';
import { getProjectId } from '../../adapters/socket/paths.js';
function manifestPath(cwd) {
    const resolver = createNpmResolver();
    const projectId = getProjectId(cwd);
    return join(resolver.getBaseDir(), projectId, 'skill-manifest.json');
}
export function registerManifestCommands(program, opts) {
    const manifest = program
        .command('manifest')
        .description('Manage the skill manifest');
    // tx manifest write — reads JSON from stdin
    manifest
        .command('write')
        .description('Write skill manifest from stdin (JSON)')
        .action(async () => {
        const cwd = process.cwd();
        const path = manifestPath(cwd);
        // Read JSON from stdin.
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString('utf-8').trim();
        if (input.length === 0) {
            const msg = 'No input on stdin. Pipe manifest JSON: echo \'{"..."}\'  | tx manifest write';
            if (opts.agent) {
                console.log(JSON.stringify({ status: 'error', command: 'manifest write', error: msg }));
            }
            else {
                console.error(msg);
            }
            process.exitCode = 1;
            return;
        }
        // Validate it's parseable JSON.
        try {
            JSON.parse(input);
        }
        catch {
            const msg = 'Invalid JSON on stdin.';
            if (opts.agent) {
                console.log(JSON.stringify({ status: 'error', command: 'manifest write', error: msg }));
            }
            else {
                console.error(msg);
            }
            process.exitCode = 1;
            return;
        }
        // Pretty-print and write.
        const pretty = JSON.stringify(JSON.parse(input), null, 2);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, pretty, 'utf-8');
        if (opts.agent) {
            console.log(JSON.stringify({
                status: 'ok',
                command: 'manifest write',
                display: `Manifest written to ${path}`,
                data: { path },
            }));
        }
        else {
            console.log(`Manifest written to ${path}`);
        }
    });
    // tx manifest show — prints the manifest
    manifest
        .command('show')
        .description('Show the current skill manifest')
        .action(async () => {
        const cwd = process.cwd();
        const path = manifestPath(cwd);
        try {
            const content = await readFile(path, 'utf-8');
            if (opts.agent) {
                console.log(JSON.stringify({
                    status: 'ok',
                    command: 'manifest show',
                    data: JSON.parse(content),
                }));
            }
            else {
                console.log(content);
            }
        }
        catch {
            const msg = `No manifest found at ${path}. Run tx install first.`;
            if (opts.agent) {
                console.log(JSON.stringify({ status: 'error', command: 'manifest show', error: msg }));
            }
            else {
                console.log(msg);
            }
        }
    });
}
//# sourceMappingURL=manifest.js.map