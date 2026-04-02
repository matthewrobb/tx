# Plan: mattpocock-skills-integration

## Overview

7 implementation phases, each independently shippable. No engine changes required — all skill dispatch lives in the CLI layer.

---

## Phase 1 — Types (`src/types/config.d.ts`, `src/types/output.d.ts`)

**1a. Extend `TwistedConfig`** (`src/types/config.d.ts`)
```ts
export interface TwistedConfig {
  version: "4.0";
  lanes: LaneConfig[];
  types: TypeConfig[];
  context_skills: string[];
  step_skills: Record<string, string>;         // step name → skill path
  step_review_skills: Record<string, string>;  // step name → review skill path
}
```
`StepConfig` is unchanged — skill config lives only in the top-level maps, not on individual step entries.
`TwistedSettings = Partial<TwistedConfig>` stays as-is — `Record<string, string>` merges correctly via `deepMerge` without needing `DeepPartial`.

**1b. Extend `AgentResponse`** (`src/types/output.d.ts`)
```ts
export interface AgentResponse {
  // ... existing fields ...
  review_skill?: string;      // present when a review skill is configured for the step
  context_skills?: string[];  // present when context_skills is non-empty
}
```

---

## Phase 2 — Defaults (`src/config/defaults.ts`)

```ts
step_skills: {
  scope:     "skills/mattpocock/write-a-prd",
  plan:      "skills/mattpocock/prd-to-plan",
  decompose: "skills/mattpocock/prd-to-issues",
  build:     "skills/mattpocock/tdd",
},
step_review_skills: {
  plan: "skills/mattpocock/grill-me",
},
context_skills: [],  // already present, no change
```

---

## Phase 3 — Build: vendor skill copy (`build/skills/vendor.ts`)

New module wired into `build/build.ts` before schema generation.

All skills output as **directories** — `skills/mattpocock/{skill}/SKILL.md` (plus supplementary files for `tdd`). Consistent structure; agent convention is `SKILL.md` as entry point.

```ts
const SKILLS = [
  { name: "write-a-prd",   files: ["SKILL.md"] },
  { name: "grill-me",      files: ["SKILL.md"] },
  { name: "prd-to-plan",   files: ["SKILL.md"] },
  { name: "prd-to-issues", files: ["SKILL.md"] },
  { name: "tdd",           files: ["SKILL.md", "deep-modules.md", "interface-design.md",
                                    "mocking.md", "refactoring.md", "tests.md"] },
];

// 1. Check if vendor/mattpocock-skills/ exists
// 2. If not → execSync("git clone https://github.com/mattpocock/skills vendor/mattpocock-skills")
// 3. For each skill/file: read, prepend provenance header, write to skills/mattpocock/{skill}/{file}
```

Provenance header injected at top of each file:
```
<!-- Source: https://github.com/mattpocock/skills/tree/main/{skill}/{file} -->
<!-- License: MIT — https://github.com/mattpocock/skills/blob/main/LICENSE -->
<!-- Do not edit directly — regenerate with: npm run build -->
```

Wire into `build/build.ts`:
```ts
import { syncVendorSkills } from "./skills/vendor.js";
console.log("Vendor skills:");
syncVendorSkills(ROOT);
```

---

## Phase 4 — Step dispatch (`src/cli/commands/steps.ts`)

**4a. Add `decompose` to registered commands**

```ts
// Before:
for (const stepName of ["research", "scope", "plan", "build"] as const)
// After:
for (const stepName of ["research", "scope", "plan", "decompose", "build"] as const)
```

`estimate-tasks` not added — no skill default, no agent judgment needed.

**4b. Skill resolution + dispatch**

```ts
const cfg = ctx.config;
const skill       = cfg.step_skills[stepName];
const reviewSkill = cfg.step_review_skills[stepName];
const contextSkills = cfg.context_skills.length > 0 ? cfg.context_skills : undefined;

if (skill) {
  respond({
    status: "handoff",
    command: stepName,
    epic: active.state,
    action: { type: "invoke_skill", skill, prompt: `Execute the ${stepName} step for epic "${active.epicName}".` },
    review_skill: reviewSkill || undefined,
    context_skills: contextSkills,
    display: `Step: ${stepName} (epic: ${active.epicName})`,
  });
} else {
  respond({
    status: "handoff",
    command: stepName,
    epic: active.state,
    action: { type: "prompt_user", prompt: `Execute the ${stepName} step for epic "${active.epicName}".` },
    context_skills: contextSkills,
    display: `Step: ${stepName} (epic: ${active.epicName})`,
  });
}
```

No `laneStepConfig` helper needed — `step_skills` is the single source of truth.

---

## Phase 5 — Config plumbing

**5a.** `src/config/resolve.ts` — verify `step_skills` and `step_review_skills` flow through. `deepMerge` handles `Record<string, string>` correctly (recursive object merge).

**5b.** `ctx.config` — already on `CliContext`, no changes needed.

---

## Phase 6 — Docs

**6a. `README.md`** — add "Bundled Skills" section:
- Attribution link to `github.com/mattpocock/skills` (MIT)
- Table: skill → step → purpose
- Note: copies live in `skills/mattpocock/`, regenerate with `npm run build`

**6b. `build/skills/twisted-work.ts`** (generates `skills/tx/SKILL.md`) — add section:
- `invoke_skill` action: load and execute the named skill's `SKILL.md`
- `review_skill` field: after primary skill writes artifact, ask user "want to run `<skill>`?" — yes invokes it, no skips — then call `tx next`
- `context_skills` array: load as context before executing the step
- `step_skills` / `step_review_skills` config shape and override syntax

---

## Phase 7 — Schema

`build/schema/settings.ts` is manually written — new fields won't auto-appear. Explicitly add `step_skills` and `step_review_skills` as `additionalProperties: { type: "string" }` objects to the schema properties. Regenerate with `npm run build`.

---

## Sequence

```
Phase 1 (types) → Phase 2 (defaults) → Phase 3 (vendor build)   ← parallel
                                      → Phase 4 (steps dispatch) ← parallel
                                      → Phase 5 (config check)   ← parallel
Phase 6 (docs)   — independent
Phase 7 (schema) — after Phase 1
```

---

## Decisions Locked In (from grill-me review)

- `StepConfig` unchanged — no `skill` field; `step_skills` map is the only source of truth
- `TwistedSettings` stays `Partial<TwistedConfig>` — `DeepPartial` not needed
- `ctx.config` already on `CliContext` — Phase 5 is verification only
- `decompose` added to CLI commands; `estimate-tasks` not added
- All vendor skills output as directories (`skills/mattpocock/{skill}/SKILL.md`)
- Review skill prompt is inline agent behavior (not engine-driven)
- `AgentResponse.review_skill` and `AgentResponse.context_skills` are top-level response fields, not inside `action`
- Schema builder (`build/schema/settings.ts`) must be updated manually
