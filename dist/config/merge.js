/**
 * Deep merge utility for sparse config overrides.
 *
 * Rules:
 * - Nested objects merge recursively
 * - Scalars and arrays replace (no array merging)
 * - Undefined values are skipped
 */
export function deepMerge(target, ...sources) {
    const result = { ...target };
    for (const source of sources) {
        if (!source)
            continue;
        for (const key of Object.keys(source)) {
            const sourceVal = source[key];
            if (sourceVal === undefined)
                continue;
            const targetVal = result[key];
            if (isPlainObject(targetVal) &&
                isPlainObject(sourceVal)) {
                result[key] = deepMerge(targetVal, sourceVal);
            }
            else {
                result[key] = sourceVal;
            }
        }
    }
    return result;
}
function isPlainObject(val) {
    return val !== null && typeof val === "object" && !Array.isArray(val);
}
//# sourceMappingURL=merge.js.map