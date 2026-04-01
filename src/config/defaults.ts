/**
 * Complete built-in defaults — every TwistedConfig field present.
 * This is Layer 1 of the 2-layer config resolution.
 */

import type { TwistedConfig } from "../types/config.js";

/**
 * Built-in defaults — artifact-driven engine with 6-lane filesystem.
 * Lanes: 0-backlog | 1-ready | 2-active | 3-review | 4-done | 5-archive
 */
export const defaults: TwistedConfig = {
  version: "4.0",

  lanes: [
    {
      name: "backlog",
      dir: "0-backlog",
      steps: [],
    },
    {
      name: "ready",
      dir: "1-ready",
      steps: [
        {
          name: "estimate",
          produces: [{ path: "estimate.json" }],
          exit_when: [{ name: "artifact.exists", args: { path: "estimate.json" } }],
        },
      ],
    },
    {
      name: "active",
      dir: "2-active",
      steps: [
        {
          name: "research",
          produces: [{ path: "research/research.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "research/research.md" } }],
        },
        {
          name: "scope",
          requires: [{ path: "research/research.md" }],
          produces: [{ path: "scope.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "scope.md" } }],
        },
        {
          name: "plan",
          requires: [{ path: "scope.md" }],
          produces: [{ path: "plan.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "plan.md" } }],
        },
        {
          name: "decompose",
          requires: [{ path: "plan.md" }],
          produces: [{ path: "stories.json" }],
          exit_when: [{ name: "artifact.exists", args: { path: "stories.json" } }],
        },
        {
          name: "build",
          requires: [{ path: "stories.json" }],
          exit_when: [{ name: "tasks.all_done" }],
        },
      ],
      entry_requires: [{ name: "lane.exists", args: { dir: "1-ready" } }],
    },
    {
      name: "review",
      dir: "3-review",
      steps: [
        {
          name: "review",
          produces: [{ path: "review.md" }],
          exit_when: [{ name: "artifact.exists", args: { path: "review.md" } }],
        },
      ],
    },
    {
      name: "done",
      dir: "4-done",
      steps: [],
    },
    {
      name: "archive",
      dir: "5-archive",
      steps: [],
    },
  ],

  types: [
    { type: "feature", lanes: ["0-backlog", "1-ready", "2-active", "4-done"] },
    { type: "bug", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "spike", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "chore", lanes: ["0-backlog", "2-active", "4-done"] },
    { type: "release", lanes: ["0-backlog", "1-ready", "2-active", "3-review", "4-done"] },
  ],

  context_skills: [],
};
