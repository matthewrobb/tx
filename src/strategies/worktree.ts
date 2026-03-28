/**
 * Worktree path generation for 1/2/3 tier configurations.
 */

import type { WorktreeTiers } from "../../types/execution.js";

export interface WorktreePaths {
  /** Objective worktree (branched from main). Always present. */
  objective: string;
  /** Group worktree (branched from objective). Only for 3 tiers. */
  group: ((groupNumber: number) => string) | null;
  /** Agent worktree. Branched from objective (2 tier) or group (3 tier). */
  agent: ((groupNumber: number, agentNumber: number) => string) | null;
}

/**
 * Generate worktree paths for a given tier configuration.
 */
export function getWorktreePaths(
  worktreeDir: string,
  objective: string,
  tiers: WorktreeTiers,
): WorktreePaths {
  const base = `${worktreeDir}/${objective}`;

  switch (tiers) {
    case 1:
      return {
        objective: base,
        group: null,
        agent: null,
      };

    case 2:
      return {
        objective: base,
        group: null,
        agent: (_g, n) => `${base}-agent-${n}`,
      };

    case 3:
      return {
        objective: base,
        group: (g) => `${base}-group-${g}`,
        agent: (g, n) => `${base}-group-${g}-agent-${n}`,
      };
  }
}

/**
 * Generate git worktree add commands for a given tier configuration.
 */
export function getWorktreeCommands(
  worktreeDir: string,
  objective: string,
  tiers: WorktreeTiers,
  groupNumber: number,
  agentCount: number,
): string[] {
  const paths = getWorktreePaths(worktreeDir, objective, tiers);
  const commands: string[] = [];

  // Objective worktree (always)
  commands.push(
    `git worktree add ${paths.objective} -b ${objective}`,
  );

  switch (tiers) {
    case 1:
      // No agent worktrees — agents work on objective branch
      break;

    case 2:
      // Agent worktrees branched from objective
      for (let i = 1; i <= agentCount; i++) {
        const agentPath = paths.agent!(groupNumber, i);
        commands.push(
          `git worktree add ${agentPath} -b ${objective}/agent-${i} ${objective}`,
        );
      }
      break;

    case 3:
      // Group worktree branched from objective
      const groupPath = paths.group!(groupNumber);
      commands.push(
        `git worktree add ${groupPath} -b ${objective}/group-${groupNumber} ${objective}`,
      );
      // Agent worktrees branched from group
      for (let i = 1; i <= agentCount; i++) {
        const agentPath = paths.agent!(groupNumber, i);
        commands.push(
          `git worktree add ${agentPath} -b ${objective}/group-${groupNumber}/agent-${i} ${objective}/group-${groupNumber}`,
        );
      }
      break;
  }

  return commands;
}
