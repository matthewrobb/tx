import type { PresetOverrides } from "../../types/preset.js";

export const minimal: PresetOverrides = {
  pipeline: {
    research: { provider: "skip", fallback: "skip", options: {} },
    arch_review: { provider: "skip", fallback: "skip", options: {} },
    qa: { provider: "skip", fallback: "skip", options: {} },
  },
  execution: {
    test_requirement: "deferred",
  },
};
