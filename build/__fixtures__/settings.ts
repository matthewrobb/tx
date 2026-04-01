/**
 * Fixture data for various settings.json configurations.
 */

type Settings = Record<string, unknown>;

/** No config — pure defaults. */
export const empty: Settings = {};

/** Custom execution settings. */
export const customExecution: Settings = {
  execution: {
    strategy: "agent-teams",
    worktree_tiers: 3,
  },
};

/** Custom flow settings. */
export const customFlow: Settings = {
  flow: {
    auto_advance: false,
  },
};

/** Full custom overrides. */
export const customized: Settings = {
  execution: {
    strategy: "agent-teams",
    worktree_tiers: 3,
  },
  flow: {
    auto_advance: false,
  },
  plan: {
    categories: ["scope", "behavior", "constraints", "acceptance", "performance"],
  },
};
