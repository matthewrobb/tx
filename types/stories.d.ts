// types/stories.d.ts

/**
 * A story represents a user-facing capability within an epic.
 * Stories are produced by the decompose step and tracked in stories.json.
 */
export interface Story {
  /** Story identifier (S-001 format). */
  id: string;

  /** Short summary of what the user can do. */
  summary: string;

  /** Acceptance criteria. */
  acceptance: string[];

  /** Whether all tasks for this story are done. */
  done: boolean;

  /** ISO-8601 date when the story was created. */
  created: string;
}

/**
 * The stories.json file stored in an epic's lane directory.
 * Produced by the decompose step; consumed by the build step.
 */
export interface StoriesFile {
  epic: string;
  stories: Story[];
  created: string;
  updated: string;
}
