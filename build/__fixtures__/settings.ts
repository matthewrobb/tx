/**
 * Fixture data for various settings.json configurations.
 */

import type { TwistedSettings } from "../../types/config.js";

/** No config — pure defaults. */
export const empty: TwistedSettings = {};

/** gstack only. */
export const gstackOnly: TwistedSettings = {
  presets: ["gstack"],
};

/** Nimbalyst primary, also track in twisted format. */
export const nimbalystWithTwisted: TwistedSettings = {
  presets: ["nimbalyst"],
  tracking: ["nimbalyst", "twisted"],
};

/** gstack primary, also track in nimbalyst. */
export const gstackWithNimbalyst: TwistedSettings = {
  presets: ["gstack"],
  tracking: ["gstack", "nimbalyst"],
};

/** Full stack: nimbalyst > gstack. */
export const fullStack: TwistedSettings = {
  presets: ["nimbalyst", "gstack"],
  tracking: ["nimbalyst", "twisted"],
};

/** Minimal — skip everything. */
export const minimalOnly: TwistedSettings = {
  presets: ["minimal"],
};

/** Custom overrides on top of presets. */
export const customized: TwistedSettings = {
  presets: ["gstack"],
  tracking: ["twisted", "nimbalyst"],
  execution: {
    strategy: "agent-teams",
    worktree_tiers: 3,
  },
  flow: {
    auto_advance: false,
  },
  decompose: {
    categories: ["scope", "behavior", "constraints", "acceptance", "performance"],
  },
};
