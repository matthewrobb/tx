import type { PresetOverrides } from "../../types/preset.js";

export const superpowers: PresetOverrides = {
  execution: {
    discipline: "superpowers:test-driven-development",
  },
  pipeline: {
    code_review: {
      provider: "superpowers:requesting-code-review",
      fallback: "built-in",
    },
  },
};
