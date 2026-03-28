/**
 * Deep merge utility for sparse config overrides.
 *
 * Rules:
 * - Nested objects merge recursively
 * - Scalars and arrays replace (no array merging)
 * - Undefined values are skipped
 */

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  const result = { ...target };

  for (const source of sources) {
    if (!source) continue;

    for (const key of Object.keys(source) as Array<keyof T>) {
      const sourceVal = source[key];
      if (sourceVal === undefined) continue;

      const targetVal = result[key];

      if (
        isPlainObject(targetVal) &&
        isPlainObject(sourceVal)
      ) {
        result[key] = deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        ) as T[keyof T];
      } else {
        result[key] = sourceVal as T[keyof T];
      }
    }
  }

  return result;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}
