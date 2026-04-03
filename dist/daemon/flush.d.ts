import type { ProjectionPort } from '../ports/projection.js';
export declare class ProjectionFlusher {
    private readonly projection;
    private dirty;
    private timer;
    private readonly FLUSH_INTERVAL_MS;
    constructor(projection: ProjectionPort);
    /** Mark an issue slug as needing projection (call after every DB write). */
    markDirty(issueSlug: string): void;
    /** Flush all dirty projections immediately. */
    flush(): Promise<void>;
    /** Start the auto-flush timer. */
    start(): void;
    /** Stop the auto-flush timer and do a final flush. */
    stop(): Promise<void>;
}
//# sourceMappingURL=flush.d.ts.map