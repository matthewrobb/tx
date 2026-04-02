# Research: mattpocock-skills-integration

**Epic:** `mattpocock-skills-integration`
**Date:** 2026-04-02

---

## 1. Mattpocock Skills — Status

**Available locally at `vendor/mattpocock-skills/`** — cloned from [github.com/mattpocock/skills](https://github.com/mattpocock/skills) (MIT license). All are pure SKILL.md behavioral directives (no CLI, no I/O contract) — same pattern as `superpowers/test-driven-development`.

### Skills and step mapping

| Skill | What it does | Twisted step |
|---|---|---|
| `write-a-prd` | Structured user interview → explores codebase → produces full PRD (problem statement, user stories, implementation decisions) as a GitHub issue | `scope` |
| `grill-me` | Stress-tests a plan by interviewing one question at a time, walking every decision branch, recommending answers, resolving questions from codebase | `research` or pre-`scope` |
| `prd-to-plan` | Takes a PRD and breaks it into phased tracer-bullet vertical slices, identifies durable architectural decisions, writes approved plan to `./plans/` | `plan` |
| `prd-to-issues` | Fetches PRD issue, decomposes into thin vertical-slice GitHub issues (HITL/AFK labels, dependency tracking), creates via `gh issue create` | `decompose` |
| `tdd` | Strict vertical red-green-refactor cycles, one test at a time, behavior-facing integration tests over unit tests, refactor pass at end | `build` |

`tdd` also ships with supplementary reference files (`deep-modules.md`, `interface-design.md`, `mocking.md`, `refactoring.md`, `tests.md`) loaded as context.

**Primary blocker resolved.** Skills are sourced; `vendor/` is git-ignored.

---

## 2. Current Config — What Exists

### `StepConfig` (no `skill` field)
```ts
interface StepConfig {
  name: string;
  produces?: ArtifactRef[];
  requires?: ArtifactRef[];
  exit_when?: PredicateRef[];
  prompt?: string;  // defined but never read
}
```

### `TwistedConfig` (`context_skills` orphan)
```ts
interface TwistedConfig {
  version: "4.0";
  lanes: LaneConfig[];
  types: TypeConfig[];
  context_skills: string[];  // defined in defaults as [], never consumed anywhere
}
```

### `AgentAction` (`invoke_skill` already typed)
```ts
type AgentAction =
  | { type: "invoke_skill"; skill: string; prompt?: string }
  | { type: "prompt_user"; prompt: string; categories?: string[] }
  | ...
```

The wire for skill dispatch is **already present in the type system** — `invoke_skill` exists as an action type. No step command currently emits it; they all emit `prompt_user`.

---

## 3. Current Step Execution

`tx research`, `tx scope`, `tx plan`, `tx build` all live in `src/cli/commands/steps.ts`. They are structurally identical:

1. Locate epic, validate current step matches.
2. Return `status: "handoff"` + `action: { type: "prompt_user", prompt: "Execute the <step> step for epic <name>." }`

The engine (`txNext`) advances based purely on artifact/predicate satisfaction — no skill awareness needed there.

---

## 4. Gap Analysis

| Area | Current | Gap |
|---|---|---|
| `StepConfig.skill` | Does not exist | Add to type |
| `context_skills` consumer | Defined, never read | Add consumer in step handoff |
| Step handoff | Always `prompt_user` | Conditionally emit `invoke_skill` when skill configured |
| `step_skills` override map | Does not exist | Add sparse top-level override so users don't rewrite entire lanes array |
| Skill resolution | None | Resolve identifier → installed skill path |
| `StepConfig.prompt` | Defined, never read | Wire it or remove it |
| mattpocock skills locally | `vendor/mattpocock-skills/` (cloned, git-ignored) | ✓ Resolved |

---

## 5. Proposed Config Shape

**Preferred: Option B — top-level `step_skills` sparse map**

```jsonc
// .twisted/settings.json
{
  "step_skills": {
    "research": "mattpocock/grill-me",
    "scope":    "mattpocock/grill-me",
    "plan":     "mattpocock/prd-to-plan",
    "decompose": "mattpocock/prd-to-issues",
    "build":    "mattpocock/tdd"
  },
  "context_skills": ["superpowers/verification-before-completion"]
}
```

Flat map, merges cleanly with `deepMerge` without requiring full lane array re-declaration.

**Type additions:**
```ts
// StepConfig
skill?: string;

// TwistedConfig
step_skills?: Record<string, string>;  // step name → skill identifier
```

**Updated step handoff:**
1. Look up `StepConfig.skill` or `config.step_skills[stepName]`
2. If found → emit `{ type: "invoke_skill", skill: "...", prompt: "Execute <step> step for epic <name>." }`
3. If not → emit current `prompt_user`
4. If `context_skills` non-empty → include in response for agent to load as context

---

## 6. Open Questions

1. ~~**Where do mattpocock skills come from?**~~ **Resolved** — cloned from `github.com/mattpocock/skills` (MIT) into `vendor/mattpocock-skills/`.
2. **`invoke_skill` vs context injection** — do skills *replace* step behavior (full handoff) or *augment* it (loaded alongside `prompt_user`)?
3. **Skill identifier format** — `"mattpocock/tdd"` vs `"tdd@mattpocock"` vs bare `"tdd"`? Must align with how `invoke_skill` resolves installed skills.
4. **`context_skills` consumer** — in scope for this epic or separate chore?
5. **`StepConfig.prompt`** — wire it as the `prompt` passed to `invoke_skill`, or remove?

---

## Key Files

| File | Role |
|---|---|
| `src/types/config.d.ts` | Add `skill` to `StepConfig`, `step_skills` to `TwistedConfig` |
| `src/config/defaults.ts` | Add `step_skills: {}` default |
| `src/cli/commands/steps.ts` | Emit `invoke_skill` when skill configured |
| `src/config/merge.ts` | No changes needed if `step_skills` map approach adopted |
| `skills/tx/SKILL.md` | Document skill dispatch behavior for agents |
| `vendor/mattpocock-skills/` | Cloned mattpocock skills repo (git-ignored, build prerequisite) |
| `skills/mattpocock/` | Build output — committed copies with provenance headers |
| `build/skills/vendor.ts` | New build module that copies and annotates vendor skills |
| `~/.claude/plugins/installed_plugins.json` | No mattpocock plugin present (vendor path used instead) |
