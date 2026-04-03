---
name: dogfood
description: Build, test, commit, and sync the twisted-workflow worktree for local dogfooding. Use after making source changes that need to be tested via the live tx CLI.
user-invocable: true
---

# Dogfood: Build + Sync Worktree

Rebuild twisted-workflow and sync the worktree so the globally-linked `tx` CLI picks up changes.

## Steps

1. **Build skills and schemas**:
   ```bash
   npm run build
   ```

2. **Compile CLI to dist/**:
   ```bash
   npm run build:cli
   ```
   If this fails with type errors, fix them before proceeding.

3. **Run tests**:
   ```bash
   npm test
   ```
   All tests must pass. Do not proceed if tests fail.

4. **Stage and commit** (only source + build output, skip .scratch/ and .twisted/ session files):
   ```bash
   git add src/ dist/ skills/ schemas/ build/ .claude-plugin/ package.json
   ```
   Use a descriptive commit message. If there are no changes to commit, skip this step.

5. **Sync the worktree** so the globally-linked `tx` binary picks up the new dist/:
   ```bash
   git -C .claude/worktrees/twisted-workflow merge <current-branch> --no-edit
   ```
   Replace `<current-branch>` with the output of `git branch --show-current`.

6. **Verify** the CLI reports the expected version:
   ```bash
   tx --version
   ```

## Notes

- The global `tx` binary is npm-linked to `.claude/worktrees/twisted-workflow/`, not the main repo. The worktree merge is what makes changes visible to the CLI.
- If you bumped the version in package.json, also update it in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `src/cli/index.ts` (hardcoded `.version()` call).
- Run `npm link` in the main repo if the worktree link is broken.
