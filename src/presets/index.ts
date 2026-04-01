import { twisted } from "./twisted.js";
import { minimal } from "./minimal.js";
import type { PresetOverrides } from "../../types/preset.js";
import type { TwistedConfigV4 } from "../../types/config.js";

export { twisted, minimal };

export const allPresets: Record<string, PresetOverrides> = {
  twisted,
  minimal,
};

/** v4 preset: minimal — skips review lane. */
export const minimalV4: Partial<TwistedConfigV4> = {
  types: [
    { type: "feature", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "bug", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "spike", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "chore", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "release", lanes: ["0-backlog", "2-active", "3-review", "4-done"] },
  ],
};

export const allPresetsV4: Record<string, Partial<TwistedConfigV4>> = {
  minimal: minimalV4,
};
