import type { PresetOverrides } from "../../types/preset.js";

export const minimal: PresetOverrides = {
  pipeline: {
    research: { provider: "skip", fallback: "skip" },
    arch_review: { provider: "skip", fallback: "skip" },
    code_review: { provider: "skip", fallback: "skip" },
    qa: { provider: "skip", fallback: "skip" },
    ship: { provider: "skip", fallback: "skip" },
  },
  execution: {
    test_requirement: "deferred",
  },
};
