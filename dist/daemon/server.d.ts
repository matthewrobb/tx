export interface DaemonConfig {
    /** Directory for PGLite data files (e.g., .twisted/data). */
    dataDir: string;
    /** Base path for markdown projections (e.g., .twisted/). */
    basePath: string;
    /** Socket path for IPC. */
    socketPath: string;
}
export declare class TwistedDaemon {
    private readonly config;
    private db;
    private projection;
    private flusher;
    private server;
    constructor(config: DaemonConfig);
    /**
     * Start the daemon: create PGLite adapter, bind socket, start listening.
     *
     * Ensures the data directory exists, initializes the storage adapter (which
     * runs migrations), creates the projection adapter and flusher, then binds
     * the net.Server to the configured socket path.
     */
    start(): Promise<void>;
    /**
     * Stop the daemon: close socket, flush dirty projections, close DB.
     *
     * Order matters: stop accepting new connections first, flush pending
     * projections, then release the database.
     */
    stop(): Promise<void>;
    /**
     * Handle a single socket connection.
     *
     * Accumulates incoming data until a newline is found, parses the JSON
     * request, dispatches to the appropriate handler, and writes the JSON
     * response back. The connection is closed after the response.
     */
    private handleConnection;
    /**
     * Parse a request line, dispatch, write the response, and close.
     */
    private processRequest;
}
/**
 * Start a daemon for the current project.
 *
 * Resolves the project ID from `cwd`, derives the socket path and data
 * directory, and starts the TwistedDaemon.
 */
export declare function startDaemon(cwd?: string): Promise<TwistedDaemon>;
//# sourceMappingURL=server.d.ts.map