/**
 * Fixture data for various settings.json configurations.
 */

import type { TwistedSettings } from "../../types/config.js";

/** No config — pure defaults. */
export const empty: TwistedSettings = {};

/** Custom execution settings. */
export const customExecution: TwistedSettings = {
  execution: {
    strategy: "agent-teams",
    worktree_tiers: 3,
  },
};

/** Custom flow settings. */
export const customFlow: TwistedSettings = {
  flow: {
    auto_advance: false,
  },
};

/** Full custom overrides. */
export const customized: TwistedSettings = {
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
