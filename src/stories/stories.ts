/**
 * Stories CRUD — create, read, update, and delete stories within an epic.
 *
 * Stories are stored in stories.json under the epic's lane directory.
 * Produced by the decompose step; each story links to one or more tasks.
 */

import type { Story, StoriesFile } from "../../types/stories.js";

/**
 * Create a new story with the given summary and acceptance criteria.
 *
 * @param existing - Current list of stories.
 * @param summary - One-line summary of the user-facing capability.
 * @param acceptance - Acceptance criteria strings.
 */
export function createStory(
  existing: Story[],
  summary: string,
  acceptance: string[] = [],
): Story {
  const seq = existing.length + 1;
  return {
    id: `S-${String(seq).padStart(3, "0")}`,
    summary,
    acceptance,
    done: false,
    created: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Mark a story as done (all its tasks complete).
 *
 * @param stories - Current list of stories.
 * @param id - Story ID (e.g. "S-001").
 */
export function markStoryDone(stories: Story[], id: string): Story[] {
  return stories.map((s) => (s.id === id ? { ...s, done: true } : s));
}

/**
 * Find a story by ID.
 */
export function findStory(stories: Story[], id: string): Story | undefined {
  return stories.find((s) => s.id === id);
}

/**
 * Build the StoriesFile envelope.
 */
export function buildStoriesFile(epicName: string, stories: Story[]): StoriesFile {
  const now = new Date().toISOString();
  return {
    epic: epicName,
    stories,
    created: now,
    updated: now,
  };
}

/**
 * Format a single story for human-readable display.
 */
export function formatStory(story: Story): string {
  const done = story.done ? "[x]" : "[ ]";
  return `${done} [${story.id}] ${story.summary}`;
}
