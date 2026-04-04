# engine-v5: Schema Alignment, Libraries, Presets

Major refactor to align with industry conventions, adopt battle-tested libraries,
and add a composable preset system. Depends on hotfix-daemon-reliability landing first.

## 1. Core Engine Swap

### Replace expression parser with jexl
- Remove `src/engine/expressions/parser.ts` (~426 lines)
- Remove `src/engine/expressions/evaluator.ts` (~329 lines)
- Remove `src/engine/expressions/functions.ts` (~97 lines)
- Add jexl dependency, configure with custom functions:
  - `defined(value)`, `not_empty(value)`, `includes(array, item)`, `count(array)`
- Handle null propagation (jexl throws on undefined; wrap context in Proxy or pre-fill)
- Keep `src/engine/expressions/interactive.ts` — pause/resume for `confirm()`/`prompt()`/`choose()` is tx-specific
- Keep `src/engine/expressions/context.ts` — trivial helpers, inline into engine

### Replace DAG resolver with toposort
- Remove `src/engine/dag.ts` (~224 lines)
- Add toposort dependency
- Post-process sorted output to extract parallel execution groups
- Keep duplicate ID and unknown dependency validation as pre-checks

**Net reduction: ~1,000 lines replaced by ~200 lines of library config**

## 2. Schema Renames

Align with GitHub Actions, GitLab CI, Argo Workflows, Backstage conventions.

| Current | New | Rationale |
|---------|-----|-----------|
| `produces` | `outputs` | Universal across GHA, Argo, Nx, Backstage |
| `requires` | `inputs` | Same |
| `title` on steps | `name` | Matches GHA, Argo, Backstage |
| `step_skills` (top-level) | `uses` on step | Every system puts action ref on the step |
| `step_review_skills` (top-level) | `review` on step | Same principle |
| `artifacts.all_present` | `outputs.all_present` | Follows from produces→outputs |

### What stays
- `needs` — matches GHA/GitLab exactly
- `done_when` / `skip_when` / `block_when` — novel for agentic domain
- `prompt` — unique tx differentiator
- `default_for` — domain-appropriate
- `context_skills` — stays top-level (injected at every step)

### Migration
- Update all type definitions in `src/types/`
- Update expression context builders
- Update schema generator (`build/schema/settings.ts`)
- Update all tests
- Update CLAUDE.md, README, TECHNICAL-DESIGN.md, skill content

## 3. Preset System

### `extends: string | string[]` on WorkflowConfig
- Already partially implemented (single string extends works today)
- Extend to support arrays — fold/reduce over multiple bases
- Conflict resolution: last wins, user overrides always win

### Built-in presets
Base presets define steps with `outputs`, `done_when`, `name`:

| Preset | Steps |
|--------|-------|
| `feature` | research → scope → plan → decompose → build |
| `bug` | reproduce → fix → verify |
| `chore` | do |
| `spike` | research → recommend |

Mixin presets add steps referencing well-known step IDs in `needs`.
Design as needed — none shipping initially.

### `strict` flag
Boolean on WorkflowConfig. When true, applies to all steps that don't already have them:
- `outputs` — auto-generates `[{ path: "{step_id}" }]`
- `done_when` — sets `"outputs.all_present"`

### Update `tx init`
- Offer preset choices during setup
- Wire selected presets into `extends` in generated settings

### Example config
```json
{
  "workflows": [
    {
      "id": "feature",
      "extends": ["feature"],
      "strict": true,
      "steps": [
        { "id": "research", "uses": "@mattpocock/skills/architecture" },
        { "id": "plan", "review": "@mattpocock/skills/grill-me" }
      ]
    },
    {
      "id": "bug",
      "extends": ["bug"]
    }
  ]
}
```

## 4. Config File Discovery

Support `.twisted.json` as an alternative to `.twisted/settings.json`:
- [ ] Add file discovery: check `.twisted/settings.json` first, fall back to `.twisted.json`
- [ ] Both use the same schema and config resolution
- [ ] `tx init` asks which layout to use (or defaults to `.twisted/settings.json`)

## 5. Order of Operations

1. Land hotfix-daemon-reliability first
2. Schema renames (types, tests, docs)
3. jexl + toposort swap
4. Preset system + strict flag
5. tx init updates
6. Full rebuild + version bump
