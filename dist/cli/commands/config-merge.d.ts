/**
 * Deep-merge `patch` into `.twisted/settings.json`.
 * Creates the file if it doesn't exist. Preserves all existing fields.
 */
export declare function mergeIntoSettings(projectDir: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
//# sourceMappingURL=config-merge.d.ts.map