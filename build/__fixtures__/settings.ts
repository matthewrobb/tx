/**
 * Fixture data for various settings.json configurations.
 */

import type { TwistedSettings } from "../../types/config.js";

/** No config — pure defaults. */
export const empty: TwistedSettings = {};

/** Superpowers only. */
export const superpowersOnly: TwistedSettings = {
  presets: ["superpowers"],
};

/** gstack only. */
export const gstackOnly: TwistedSettings = {
  presets: ["gstack"],
};

/** Nimbalyst primary, also track in twisted format. */
export const nimbalystWithTwisted: TwistedSettings = {
  presets: ["nimbalyst", "superpowers"],
  tracking: ["nimbalyst", "twisted"],
};

/** gstack primary, also track in nimbalyst. */
export const gstackWithNimbalyst: TwistedSettings = {
  presets: ["gstack"],
  tracking: ["gstack", "nimbalyst"],
};

/** Full stack: nimbalyst > superpowers > gstack. */
export const fullStack: TwistedSettings = {
  presets: ["nimbalyst", "superpowers", "gstack"],
  tracking: ["nimbalyst", "twisted"],
};

/** Minimal — skip everything. */
export const minimalOnly: TwistedSettings = {
  presets: ["minimal"],
};

/** Custom overrides on top of presets. */
export const customized: TwistedSettings = {
  presets: ["superpowers", "gstack"],
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
