/**
 * ProjectionPort — one-way rendering from DB state to filesystem.
 *
 * The engine calls projection methods after every state change to keep
 * `.twisted/` in sync with the database. This is strictly one-way: the DB
 * is the source of truth (Guiding Principle #4: "DB is truth"), and the
 * filesystem is a read-only projection for human consumption and git commits.
 *
 * Methods take slugs/IDs rather than domain objects. The adapter queries the
 * DB itself to build the rendered output. This keeps the port interface clean
 * and decoupled from domain type evolution — adding a field to Issue doesn't
 * require changing this interface.
 */

// ── Projection port ────────────────────────────────────────────

export interface ProjectionPort {
  /**
   * Render the current state of an issue to filesystem.
   * Writes to `.twisted/{lane}/{issueSlug}/` with state, artifacts, notes, etc.
   */
  renderIssue(issueSlug: string): Promise<void>;

  /**
   * Render the active cycle summary to filesystem.
   * Writes to `.twisted/cycle/{cycleSlug}/` with pulled issues, status, timeline.
   */
  renderCycle(cycleSlug: string): Promise<void>;

  /**
   * Render a checkpoint to filesystem.
   * Writes to `.twisted/checkpoints/{checkpointId}.md` with context bridge content.
   */
  renderCheckpoint(checkpointId: string): Promise<void>;

  /**
   * Render a full snapshot of all projectable state.
   * Called after bulk changes (e.g., migration, import, cycle close) to ensure
   * the entire filesystem is consistent with the DB.
   */
  renderSnapshot(): Promise<void>;

  /**
   * Delete filesystem artifacts for a closed or archived issue.
   * Removes the `.twisted/{lane}/{issueSlug}/` directory tree.
   */
  deleteIssue(issueSlug: string): Promise<void>;
}
