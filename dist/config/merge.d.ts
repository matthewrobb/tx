/**
 * Deep merge utility for sparse config overrides.
 *
 * Rules:
 * - Nested objects merge recursively
 * - Scalars and arrays replace (no array merging)
 * - Undefined values are skipped
 */
export declare function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Array<Partial<T>>): T;
//# sourceMappingURL=merge.d.ts.map