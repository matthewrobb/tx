---
name: using-twisted-workflow
description: "Shared reference — config resolution, presets, and tracking strategy artifact map"
---

# twisted-workflow shared reference

Config resolution, preset composition, and tracking strategy artifact mapping.

---

## Config Resolution

Read `src/config/resolve.ts` for the full implementation. Read `src/config/defaults.ts` for default values. Read `presets/{name}.json` for each active preset's overrides.

```ts
/**
 * Resolve a complete TwistedConfig from sparse user settings.
 *
 * @param settings - The user's settings.json content (sparse overrides)
 * @param presetRegistry - Map of preset names → overrides (defaults to built-in presets)
 * @returns Fully resolved TwistedConfig with no missing fields
 */
export function resolveConfig(
  settings: TwistedSettings = {},
  presetRegistry: Record<string, PresetOverrides> = allPresets,
): TwistedConfig {
  // Extract preset names from settings
  const presetNames = settings.presets ?? [];

  // Load presets — unknown names are silently skipped
  const presetOverrides = presetNames
    .map((name) => presetRegistry[name])
    .filter((p): p is PresetOverrides => p !== undefined);

  // Apply right-to-left so the first preset has highest priority
  const reversedPresets = [...presetOverrides].reverse();

  // Extract project settings (everything except presets)
  const { presets: _, ...projectSettings } = settings;

  // 3-layer merge
  return deepMerge(
    defaults,
    ...reversedPresets,
    projectSettings as Partial<TwistedConfig>,
  );
}
```

```ts
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
```

## Presets

Each preset is a sparse JSON file in `presets/`. Read the file for the active preset to see what it overrides.

| Preset        | File                       | What it overrides                                           |
| ------------- | -------------------------- | ----------------------------------------------------------- |
| `twisted`     | `presets/twisted.json`     | tracking → twisted artifact format                          |
| `superpowers` | `presets/superpowers.json` | TDD discipline, code review → Superpowers                   |
| `gstack`      | `presets/gstack.json`      | tracking → gstack, all delegatable phases → gstack commands |
| `nimbalyst`   | `presets/nimbalyst.json`   | tracking → nimbalyst, research + code review → Nimbalyst    |
| `minimal`     | `presets/minimal.json`     | all delegatable phases → skip, tests deferred               |

First preset wins on conflict. Compose in any order:

- `["superpowers", "gstack"]` → Superpowers wins for code review, gstack fills the rest
- `["gstack", "superpowers"]` → gstack wins for code review, TDD still active

---

## Tracking Strategy Artifact Map

| Step         | twisted                    | nimbalyst                              | gstack                             |
| ------------ | -------------------------- | -------------------------------------- | ---------------------------------- |
| Research     | `{objDir}/RESEARCH-{n}.md` | `nimbalyst-local/plans/{objective}.md` | `{objDir}/DESIGN.md`               |
| Requirements | `{objDir}/REQUIREMENTS.md` | same plan doc (append)                 | `{objDir}/DESIGN.md` (append)      |
| Plan         | `{objDir}/PLAN.md`         | same plan doc (checklist)              | `{objDir}/PLAN.md` (gstack format) |
| Issues       | `{objDir}/ISSUES.md`       | embedded in plan doc                   | `{objDir}/ISSUES.md`               |
| Tracker      | —                          | `nimbalyst-local/tracker/tasks.md`     | —                                  |

