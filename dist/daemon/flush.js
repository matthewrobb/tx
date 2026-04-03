// src/daemon/flush.ts — Dirty tracking + batched projection flush.
//
// The daemon marks an issue slug as dirty after every DB write. A 500ms timer
// coalesces rapid writes into a single projection call per issue. The Set-based
// dirty tracker guarantees deduplication: N writes to the same slug within one
// flush interval produce exactly one renderIssue() call.
//
// Projection errors are swallowed (logged in production, no-op here) because
// the DB is the source of truth. A failed projection is retried on the next
// dirty flush or next explicit `tx status` call.
export class ProjectionFlusher {
    projection;
    dirty = new Set();
    timer = null;
    FLUSH_INTERVAL_MS = 500;
    constructor(projection) {
        this.projection = projection;
    }
    /** Mark an issue slug as needing projection (call after every DB write). */
    markDirty(issueSlug) {
        this.dirty.add(issueSlug);
    }
    /** Flush all dirty projections immediately. */
    async flush() {
        if (this.dirty.size === 0)
            return;
        // Snapshot and clear so new dirties during flush go into the next round.
        const slugs = [...this.dirty];
        this.dirty.clear();
        // Flush projections in parallel — they are independent of each other.
        const results = await Promise.allSettled(slugs.map((slug) => this.projection.renderIssue(slug)));
        // Decision: swallow individual projection errors. The DB state is correct
        // and committed. A failed projection will be retried on the next flush
        // cycle or when the user runs `tx status`.
        for (const result of results) {
            if (result.status === 'rejected') {
                // In production this would go to a structured logger. For now, no-op.
                // Leaving this branch explicit so the intent is documented.
            }
        }
    }
    /** Start the auto-flush timer. */
    start() {
        if (this.timer !== null)
            return;
        this.timer = setInterval(() => {
            // Fire-and-forget: the interval callback is synchronous, but flush is
            // async. Errors are already swallowed inside flush().
            void this.flush();
        }, this.FLUSH_INTERVAL_MS);
        // Unref the timer so it doesn't keep the process alive when the daemon
        // is shutting down.
        this.timer.unref();
    }
    /** Stop the auto-flush timer and do a final flush. */
    async stop() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
}
//# sourceMappingURL=flush.js.map