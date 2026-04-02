# Scope: mattpocock-skills-integration

## What We're Building

A pluggable skill dispatch layer for twisted-workflow steps. When a skill is configured for a step, `tx <step>` emits `invoke_skill` instead of `prompt_user`, handing execution to that skill. Ships with first-class defaults wiring the five mattpocock skills to their natural steps.

---

## In Scope

### 1. Config schema additions
- Add `skill?: string` to `StepConfig`
- Add `review_skill?: string` to `StepConfig` — an optional follow-up skill the agent offers to run after the primary skill writes its artifact
- Add `step_skills?: Record<string, string>` to `TwistedConfig` (sparse override map)
- Add `step_review_skills?: Record<string, string>` to `TwistedConfig` (sparse override map for review skills)
- Add `step_skills: {}` and `step_review_skills: {}` to `defaults.ts`

### 2. Step handoff dispatch (`src/cli/commands/steps.ts`)
- Resolve skill: check `config.step_skills[stepName]` first, then `StepConfig.skill`
- Resolve review skill: check `config.step_review_skills[stepName]` first, then `StepConfig.review_skill`
- If skill found → emit `{ type: "invoke_skill", skill: "<identifier>", review_skill?: "<identifier>", prompt: "Execute the <step> step for epic <name>." }`
- If no skill → current `prompt_user` behavior (no regression)
- When `review_skill` is present in the response, the SKILL.md agent runs the primary skill, then **asks the user** "Would you like to review with `<skill name>`?" before calling `tx next`

### 3. `context_skills` consumer
- Wire existing (currently orphaned) `context_skills` array into the step handoff response
- Include as `context_skills` field on `AgentResponse` so the SKILL.md agent can load them before executing the step

### 4. Build-time skill copy (`build/skills/vendor.ts`)
A new build module copies SKILL.md files (and any supplementary `.md` files) from `vendor/mattpocock-skills/{skill}/` to `skills/mattpocock/{skill}.md` (or `skills/mattpocock/{skill}/` for multi-file skills like `tdd`). The copied files are **committed to git** — `vendor/` stays gitignored.

Each copied file gets a provenance header injected at the top:
```md
<!-- Source: https://github.com/mattpocock/skills/{skill}/SKILL.md (MIT License) -->
<!-- Do not edit directly — regenerate with `npm run build` -->
```

`npm run build` runs this copy step automatically. The build module:
1. Checks if `vendor/mattpocock-skills/` exists
2. If not → runs `git clone https://github.com/mattpocock/skills vendor/mattpocock-skills` automatically
3. Copies and annotates the skill files

To pull upstream changes: delete `vendor/mattpocock-skills/` and rebuild (or `git -C vendor/mattpocock-skills pull` + rebuild).

### 5. Skill identifier format
- Path relative to project root: `skills/mattpocock/tdd` (the committed output, not `vendor/`)
- Also support bare name resolution for installed plugins (e.g. `"twisted-workflow:tx"` style) — local path takes priority
- No skill availability validation in v1 (fail at agent invocation, not at CLI)

### 6. Smarter defaults
Wire mattpocock skills as the shipped defaults in `defaults.ts`:

```ts
step_skills: {
  scope:    "skills/mattpocock/write-a-prd",
  plan:     "skills/mattpocock/prd-to-plan",
  decompose: "skills/mattpocock/prd-to-issues",
  build:    "skills/mattpocock/tdd",
}
```

`grill-me` is the default `review_skill` for the `plan` step. After `prd-to-plan` writes `plan.md`, the agent asks:

> "Plan written. Would you like to run grill-me to review it before decomposing? (y/n)"

Users opt out permanently by clearing it in `settings.json`:

```jsonc
{
  "step_review_skills": {
    "plan": ""
  }
}
```

Default `review_skill` for plan: `skills/mattpocock/grill-me`.

No new steps, no engine changes — the prompt and conditional invocation live entirely in the SKILL.md agent instructions.

### 7. `StepConfig.prompt` cleanup
Wire `prompt` as the `prompt` field passed to `invoke_skill` (currently defined but never read). Removes dead surface.

### 8. SKILL.md documentation
Update `skills/tx/SKILL.md` to document skill dispatch: what `invoke_skill` means, how `context_skills` are loaded, and the `step_skills` config shape.

### 9. README attribution
Add a "Bundled Skills" section to `README.md` crediting the mattpocock skills:
- Link to `https://github.com/mattpocock/skills`
- List the five bundled skills and their mapped steps
- Note MIT license and that copies live in `skills/mattpocock/`

---

## Out of Scope

- Skill availability validation / install check at CLI time
- `grill-me` as a non-skippable step (it's always a prompted opt-in at runtime)
- Publishing mattpocock skills as a separate marketplace or plugin
- Multi-skill per step beyond primary + review
- `depends_on` / cross-epic anything
- Engine changes — skill dispatch and review prompts live entirely in the CLI/SKILL.md layer
- `prd-to-issues` GitHub integration (it creates GH issues natively — we just invoke it; twisted stories are separate)

---

## Key Decisions

**`step_skills` map over `StepConfig.skill` for user overrides** — flat map merges cleanly without forcing users to redeclare the full lanes array. `StepConfig.skill` still exists as the canonical definition location in defaults; `step_skills` is the sparse override surface.

**Local path identifiers over plugin-style names** — `vendor/mattpocock-skills/tdd` is unambiguous, works immediately without a registry lookup, and aligns with how we cloned the repo. Can be generalized later.

**`grill-me` as opt-in `review_skill` on `plan`** — `prd-to-plan` runs first and writes `plan.md`, then the agent prompts: "Want to review with grill-me?" Yes runs it, no skips. Handled entirely in the SKILL.md agent layer — no engine changes. Opt out permanently via `step_review_skills: { "plan": "" }` in settings.

**`context_skills` consumer in this epic** — it's already defined and is the global equivalent of `step_skills`. Wiring it now completes the feature without scope creep.

---

## Acceptance Criteria

- [ ] `npm run build` copies mattpocock SKILL.md files to `skills/mattpocock/` with provenance headers
- [ ] `tx scope` emits `invoke_skill: "skills/mattpocock/write-a-prd"` by default
- [ ] `tx plan` emits `invoke_skill: "skills/mattpocock/prd-to-plan"` by default
- [ ] `tx build` emits `invoke_skill: "skills/mattpocock/tdd"` by default
- [ ] `tx plan` response includes `review_skill: "skills/mattpocock/grill-me"` by default
- [ ] Agent prompts user "Want to review with grill-me?" after plan.md is written; yes invokes it, no skips
- [ ] User can suppress the prompt by setting `step_review_skills: { "plan": "" }` in settings
- [ ] User can override any step via `settings.json` `step_skills` map
- [ ] User can clear a default by setting `step_skills: { "build": "" }` (empty string = no skill)
- [ ] `context_skills` array included in step handoff response when non-empty
- [ ] Steps with no configured skill continue to emit `prompt_user` (no regression)
- [ ] SKILL.md documents the new behavior
- [ ] README.md includes "Bundled Skills" section with mattpocock attribution and MIT license note
- [ ] All existing tests pass
