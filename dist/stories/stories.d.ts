/**
 * Stories CRUD — create, read, update, and delete stories within an epic.
 *
 * Stories are stored in stories.json under the epic's lane directory.
 * Produced by the decompose step; each story links to one or more tasks.
 */
import type { Story, StoriesFile } from "../types/stories.js";
/**
 * Create a new story with the given summary and acceptance criteria.
 *
 * @param existing - Current list of stories.
 * @param summary - One-line summary of the user-facing capability.
 * @param acceptance - Acceptance criteria strings.
 */
export declare function createStory(existing: Story[], summary: string, acceptance?: string[]): Story;
/**
 * Mark a story as done (all its tasks complete).
 *
 * @param stories - Current list of stories.
 * @param id - Story ID (e.g. "S-001").
 */
export declare function markStoryDone(stories: Story[], id: string): Story[];
/**
 * Find a story by ID.
 */
export declare function findStory(stories: Story[], id: string): Story | undefined;
/**
 * Build the StoriesFile envelope.
 */
export declare function buildStoriesFile(epicName: string, stories: Story[]): StoriesFile;
/**
 * Format a single story for human-readable display.
 */
export declare function formatStory(story: Story): string;
//# sourceMappingURL=stories.d.ts.map