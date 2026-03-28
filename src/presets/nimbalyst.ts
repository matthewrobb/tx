import type { PresetOverrides } from "../../types/preset.js";

export const nimbalyst: PresetOverrides = {
  tracking: ["nimbalyst"],
  pipeline: {
    research: {
      provider: "nimbalyst:deep-researcher",
      fallback: "built-in",
    },
    code_review: {
      provider: "nimbalyst:branch-reviewer",
      fallback: "built-in",
    },
  },
};
