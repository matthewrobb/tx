// src/cli/commands/skills.ts — `tx skills` command.
//
// Lists installed skills from the skill manifest. Human-friendly table
// output by default; JSON with -a.

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createNpmResolver } from '../../adapters/npm/resolver.js';
import { resolveProjectName } from '../../config/project-name.js';

export interface GlobalOpts {
  agent: boolean;
  yolo: boolean;
}

interface SkillEntry {
  package: string;
  skill: string;
  description: string;
  detected_outputs: string[];
  has_overrides: boolean;
}

export function registerSkillsCommand(program: Command, opts: GlobalOpts): void {
  program
    .command('skills')
    .description('List installed skills from the manifest')
    .action(async () => {
      const cwd = process.cwd();
      const projectName = resolveProjectName(cwd);
      const resolver = createNpmResolver();
      const manifestPath = join(resolver.getBaseDir(), projectName, 'skill-manifest.json');

      let manifest: Record<string, { skills: Record<string, {
        description?: string;
        detected_outputs?: string[];
        suggested_overrides?: { omit?: string[]; directives?: string[] };
      }> }>;

      try {
        const raw = await readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(raw);
      } catch {
        const msg = 'No skill manifest found. Run tx install first.';
        if (opts.agent) {
          console.log(JSON.stringify({ status: 'error', command: 'skills', error: msg }));
        } else {
          console.log(msg);
        }
        return;
      }

      const entries: SkillEntry[] = [];
      for (const [pkgName, pkg] of Object.entries(manifest)) {
        for (const [skillName, skill] of Object.entries(pkg.skills ?? {})) {
          const outputs = skill.detected_outputs ?? [];
          const overrides = skill.suggested_overrides;
          const hasOverrides = (overrides?.omit?.length ?? 0) > 0
            || (overrides?.directives?.length ?? 0) > 0;
          entries.push({
            package: pkgName,
            skill: skillName,
            description: skill.description ?? '',
            detected_outputs: outputs,
            has_overrides: hasOverrides,
          });
        }
      }

      if (opts.agent) {
        console.log(JSON.stringify({
          status: 'ok',
          command: 'skills',
          data: entries,
          display: entries.map((e) => `${e.package}/${e.skill}`).join('\n'),
        }));
        return;
      }

      // Human output.
      if (entries.length === 0) {
        console.log('No skills found in manifest.');
        return;
      }

      console.log(`\n  ${entries.length} skills installed:\n`);
      for (const e of entries) {
        const badge = e.has_overrides ? ' [overrides]' : '';
        const outputs = e.detected_outputs.length > 0
          ? ` (outputs: ${e.detected_outputs.join(', ')})`
          : '';
        console.log(`  ${e.package}/${e.skill}${badge}${outputs}`);
        if (e.description) {
          console.log(`    ${e.description}`);
        }
      }
      console.log('');
    });
}
