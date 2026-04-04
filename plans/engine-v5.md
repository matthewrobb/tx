# engine-v5: The Minimal Machine

Strip tx to its core: a data-driven step engine built on toposort + jexl,
with artifacts as the state machine.

## Core Model

### Data Model

```
Issue:      name (slug), type?, status (open|closed), tags[], workflow?, parent?
Step:       name (slug), requires, outputs, uses?, done_when?,
            approved_by?, concurrent?, reduce?, after?, prompt?, vars?
Workflow:   name (slug), steps[]
Type:       name (slug), workflow?
Artifact:   name (slug), issue (ref), content, timestamp, partials[]?
Note:       summary, tags[], issue?
Checkpoint: name? (slug), summary, content
```

Everything has a `name` slug. All fields that accept a value can take
`string | string[]` — normalized to arrays internally. Artifacts are
the state machine — an issue's progress is determined entirely by which
artifacts exist.

### Issue

`name`, `type`, `status` (open|closed), `tags[]`, optional `workflow`,
optional `parent`.

- No `blocked`, `archived`, `done` — tags handle those semantics
- Type is optional, defaults to `default`
- Workflow is optional — without one, steps are triggered manually via `tx run`
- `parent: null` → root issue (gets a directory, owns artifacts)
- `parent: "some-issue"` → sub-issue (projected into parent's ISSUES.md)

#### Root vs sub-issues

Root issues own the projection directory. Sub-issues project into their
root's ISSUES.md.

Both root and sub-issues can have workflows and types. The difference
is projection and artifact ownership:

- **Root issue** — gets `open/{name}/` directory, artifacts projected
  as files, NOTES.md, ISSUES.md
- **Sub-issue** — listed in parent's ISSUES.md, artifacts namespaced
  under root (`{sub-name}/{artifact}`), can have own workflow

A root issue step can delegate to sub-issue workflows. For example,
a "build" step on a feature might decompose into sub-issues, each
with a "task" workflow. The parent step waits for sub-issues:

```json
{
  "build": {
    "done_when": "issues.all_closed"
  }
}
```

The engine, when evaluating a root issue, also advances sub-issues
that have workflows. Sub-issues can nest (sub-sub-issues) — all
project into the root's ISSUES.md noting their depth/relationships.

Sub-issues typically skip upstream steps (research, plan) since they're
already scoped work. They run execution workflows like:

```json
{ "task": { "steps": ["red-tests", "implement", "green-tests", "code-review"] } }
```

#### Execution groups

The plan/decompose step produces an execution artifact describing how
sub-issues should be run. The format uses nested arrays — serial at
top level, parallel when wrapped in an array:

```json
["auth-middleware", ["api-endpoints", "auth-types"], "integration-tests"]
```

Reads as:
1. Run `auth-middleware`
2. Run `api-endpoints` and `auth-types` in parallel
3. When both complete, run `integration-tests`

One rule, recursive. Same model as promise chaining / `Promise.all`.
The agent reads this artifact and spawns sub-agents accordingly. The
engine doesn't interpret the groups — it just advances sub-issues
when their workflows are ready. The agent handles orchestration.

#### Pull / Push

```bash
tx issue pull <child> --into <parent>   # nest child under parent
tx issue push <child>                   # promote sub-issue to root
```

**Pull** — when pulling a root issue (with artifacts) into another root issue:
- Child's artifacts become **partials** on the parent's corresponding artifacts
- Child becomes a sub-issue
- A step that sees partials synthesizes them into the final output
- The agent resolves any merge work (child's plan was scoped narrowly,
  parent's plan needs to be broader)

**Push** — promote a sub-issue to root:
- Sub-issue gets its own directory and can have workflows/artifacts
- Any partials it contributed to the parent remain

### Steps

Top-level named definitions in config. Reusable across workflows.

```json
{
  "steps": {
    "research": {
      "outputs": "research",
      "uses": "research-skill"
    },
    "plan": {
      "requires": "research",
      "outputs": "plan",
      "approved_by": "plan-review"
    },
    "plan-review": {
      "requires": "plan",
      "outputs": "plan-review"
    },
    "build": {
      "requires": "plan-review",
      "outputs": "build"
    }
  }
}
```

Step fields:
- `requires` — artifact name(s) that must exist before this step can run
- `outputs` — artifact name(s) this step produces
- `uses` — skill reference(s) to invoke (`string | string[]`)
- `done_when` — jexl expression (default: `"outputs.all_present"`)
- `approved_by` — sugar: step name whose failure gates this step's done_when
  (compiles to `done_when: "outputs.all_present and steps['{name}'].result != 'fail'"`)
- `concurrent` — number of agents to run in parallel (default: 1).
  Each writes a partial. `reduce` determines how partials become the final output.
- `reduce` — how to combine partials into the final output artifact:
  `"agent"` (default), `"concat"`, `"last"`, skill reference, or jexl expression
- `after` — agent actions to emit after step completes (flush, commit, etc.)
- `prompt` — agent prompt template with `{{}}` variables
- `vars` — static context variables injected into jexl context for this step

### Partials

Partials are a unified concept for combining multiple contributions into
one artifact. They arise from three sources:

1. **Concurrent execution** — `concurrent: 3` produces 3 partials,
   reduced into the final output
2. **Pulled-in child artifacts** — when a root issue with artifacts is
   pulled into another issue, its artifacts become partials on the parent
3. **Multiple steps outputting the same artifact** — if two steps both
   declare the same output name, each contributes a partial

The `reduce` field on the step determines how partials merge:

- `"agent"` — emit an AgentAction, agent synthesizes (default)
- `"concat"` — concatenate partial contents
- `"last"` — most recent partial wins
- Skill reference — custom reducer skill
- jexl expression — programmatic selection

Partials are stored alongside the artifact:

```js
{
  artifacts: {
    plan: {
      exists: false,              // final not yet produced
      partials: [
        { source: "auth-flow", content: "...", timestamp: 1234 },
        { source: "agent-1", content: "...", timestamp: 1235 },
        { source: "agent-2", content: "...", timestamp: 1236 }
      ]
    }
  }
}
```

A step sees partials in its jexl context and prompt. The step is not
"done" until the final artifact exists (not just partials).

### Workflows

Named sequences of step references. Assigned to issues to enable `tx next`.

```json
{
  "workflows": {
    "feature": {
      "steps": ["research", "plan", "plan-review", "build"]
    }
  }
}
```

Workflows are optional — without one, use `tx run <step> <issue>` directly.
Steps within a workflow can override step-level config using splat merging:

```json
{
  "workflows": {
    "feature": {
      "steps": [
        "research",
        { "step": "plan", "uses": ["...", "lint-plan"] },
        "plan-review",
        "build"
      ]
    }
  }
}
```

Splat (`"..."`) in arrays means "keep everything from the step definition,
append/prepend around it." This allows workflows to extend steps without
replacing their entire config.

### Types

User-defined in config. Map type name to optional workflow.

```json
{
  "types": {
    "default": {},
    "feature": { "workflow": "feature" },
    "bug": { "workflow": "bugfix" }
  }
}
```

Only `default` is built-in. Creating an issue with a type auto-assigns
the workflow. No type = `default`.

## Engine

### Three primitives

1. **toposort** — resolves step execution order from requires/outputs edges
2. **jexl** — evaluates expressions against the full issue context
3. **The loop** — finds first ready-but-not-done step, runs it, repeats

### Engine loop

```
while true:
  order = toposort(steps)
  context = buildContext(issue)
  next = order.find(step =>
    requiresMet(step, context) &&
    !jexl.eval(step.done_when, context)
  )
  if !next: break
  result = runStep(next)
  saveResult(next, result)
  invalidateDownstream(next)
```

### Result invalidation (non-destructive)

When a step runs, all downstream step results are marked `invalidated: true`
with a reason — NOT deleted. The full history stays in context. The LLM sees
"plan-review was invalidated because plan was re-run" — useful signal for
understanding what changed and why.

Invalidated results don't satisfy `done_when` checks, so downstream steps
re-run. But the previous result content is available in context for the
re-run, enabling iteration rather than starting over.

```js
{
  steps: {
    "plan-review": {
      ran: true,
      result: "fail",
      invalidated: true,
      invalidated_by: "plan",
      previous_results: [
        { result: "fail", timestamp: 1234, content: "sections 3 and 5 need work" }
      ]
    }
  }
}
```

### Review loops (emergent from data)

```json
{
  "plan": {
    "outputs": "plan",
    "done_when": "artifacts.plan.exists and steps['plan-review'].result != 'fail'"
  },
  "plan-review": {
    "requires": "plan",
    "outputs": "plan-review"
  }
}
```

1. `plan`: not done → **RUN**. Writes plan. Invalidates plan-review.
2. `plan-review`: requires met, outputs missing → **RUN**. Result: fail.
3. `plan`: done? `fail != fail` → false → **RUN** again (with review feedback in context).
4. Invalidates plan-review (previous fail result preserved in history).
5. `plan-review`: **RUN** again. Result: pass.
6. `plan`: done? `pass != fail` → true → done.

No retry/on_fail/loop machinery. Just expressions + invalidation.

### jexl context

Every expression has access to:

```js
{
  artifacts: {
    plan: {
      exists: true, timestamp: 1234, content: "...",
      partials: [{ source: "auth-flow", content: "..." }]
    },
    build: { exists: false, partials: [] }
  },
  steps: {
    plan: { ran: true, result: "pass", timestamp: 1234 },
    "plan-review": {
      ran: true, result: "fail", invalidated: true,
      previous_results: [...]
    }
  },
  issue: { name: "my-feature", type: "feature", status: "open", tags: [] },
  issues: {
    count: 3, open: 2, closed: 1,
    all_closed: false,
    items: [{ name: "sub-1", status: "open" }, ...]
  },
  notes: { count: 3, tags: { blocker: 1, decide: 2 } },
  vars: { domain: "backend", priority: "high" }
}
```

### Context vars

Steps and workflows can declare vars that accumulate in the jexl context.
Static vars come from config, dynamic vars from step outputs.

```json
{
  "steps": {
    "research": {
      "outputs": "research",
      "vars": { "domain": "backend" }
    }
  }
}
```

Steps can write dynamic vars as part of their result. Downstream steps
see accumulated vars in their jexl context. Agent directives can also
inject vars to build up context dynamically.

### Concurrent execution + reduce

A step with `concurrent: N` spawns N agents. Each writes a partial.
The `reduce` strategy combines partials into the final output:

```json
{
  "plan": {
    "outputs": "plan",
    "concurrent": 3,
    "reduce": "agent"
  }
}
```

Default `concurrent` is 1 (sequential). Default `reduce` is `"agent"`.

### After hooks

Steps can declare agent actions emitted after completion:

```json
{
  "plan": {
    "outputs": "plan",
    "after": {
      "flush": true,
      "commit": "plan: {{issue.name}}"
    }
  }
}
```

These produce AgentActions — tx doesn't run git, it tells the agent to:

```json
{ "type": "flush" }
{ "type": "commit", "message": "plan: my-feature", "files": [".twisted/..."] }
```

## CLI

```bash
# Issues
tx issue open <name> [--type <type>]
tx issue close <name>
tx issue delete <name>
tx issue tag <name> <tag>
tx issue untag <name> <tag>
tx issue pull <child> --into <parent>
tx issue push <child>
tx status [name]

# Steps
tx run <step> <issue>              # trigger a step directly
tx next [issue]                    # advance workflow (requires assigned workflow)

# Artifacts
tx write <artifact> --issue <name>  # write artifact from stdin
tx read <artifact> --issue <name>   # read artifact to stdout

# Notes
tx note <summary> [--tag <tag>] [--issue <name>]

# Sessions
tx handoff [summary]               # create checkpoint
tx pickup                          # read latest checkpoint
tx checkpoint [name] <summary>     # manual checkpoint

# Projections
tx flush                           # write projections to disk
tx reset                           # clear projections (regenerate from DB)
tx reset --hard                    # clear projections + DB (fresh start)

# Config
tx init                            # guided setup
tx wizard                          # interactive config builder
tx config show

# Skills
tx skills                          # list installed skills
tx install [package]
tx skill <name>                    # trigger an installed skill directly
```

## Projection Layout

```
.twisted/
├── settings.json
├── issues/
│   ├── open/
│   │   └── my-feature/
│   │       ├── index.md          # issue status + step progress
│   │       ├── NOTES.md          # notes (includes sub-issue notes)
│   │       ├── ISSUES.md         # sub-issues list with status/nesting
│   │       ├── research.md       # artifact projection
│   │       └── plan.md           # artifact projection
│   └── closed/
│       └── old-bug/
│           └── index.md
├── checkpoints/
│   └── {name-or-n}.md
└── snapshot.md
```

Root issues get directories. Sub-issues appear in their root's ISSUES.md.
Issues move between `open/` and `closed/` on status change.
Artifacts are projected as files in the issue directory.

## JSON Data Dump

Full state exported on daemon idle shutdown (5 min idle):
- Written to `.twisted/` for version control
- Also does a full artifact/projection flush at shutdown
- Per-issue data lives in issue directory

## Config Schema

```json
{
  "name": "my-project",
  "types": {
    "default": {},
    "feature": { "workflow": "feature" }
  },
  "steps": {
    "research": { "outputs": "research" },
    "plan": {
      "requires": "research",
      "outputs": "plan",
      "approved_by": "plan-review"
    },
    "plan-review": { "requires": "plan", "outputs": "plan-review" },
    "build": { "requires": "plan-review", "outputs": "build" }
  },
  "workflows": {
    "feature": {
      "steps": ["research", "plan", "plan-review", "build"]
    }
  },
  "dependencies": {
    "@mattpocock/skills": "github:mattpocock/skills"
  },
  "skills": {
    "tdd": { "uses": "@mattpocock/skills/tdd" },
    "my-review": { "file": "./skills/review.md" },
    "inline-lint": { "content": "Check code for..." },
    "plugin-skill": { "plugin": "some-claude-plugin/skill" }
  }
}
```

Skills section handles resolution — packages, files, inline, plugins.
Steps reference skill names via `uses`. Dependencies section manages
package installation.

Skill definitions can include overrides and directives (migrated from
the old skill-manifest.json):

```json
{
  "skills": {
    "tdd": {
      "uses": "@mattpocock/skills/tdd",
      "omit": ["Step 5"],
      "directives": [
        "Do NOT create GitHub issues. Use tx issue instead.",
        "Write outputs as artifacts via tx write. Do NOT write files directly."
      ],
      "bind": { "step": "build" }
    },
    "architecture": {
      "uses": "@mattpocock/skills/improve-codebase-architecture",
      "bind": { "step": "research" }
    }
  }
}
```

Skill fields:
- `uses` — package skill path, resolves via dependencies
- `file` — local file path to SKILL.md
- `content` — inline skill content (string)
- `plugin` — claude plugin skill reference
- `omit` — step numbers/sections to skip (avoids external outputs)
- `directives` — override instructions for the agent (replaces external
  output behavior with tx pipeline equivalents)
- `bind` — default step binding (which workflow step this skill serves)

## What's Removed

- Cycles (start/pull/close, retro, cycle_issues table)
- Sessions table (pickup/handoff are now checkpoint operations)
- Multiple built-in issue types (just `default`)
- `blocked`, `archived`, `done` statuses (just open/closed + tags)
- `skip_when`, `block_when` expressions
- `extends` on workflows, presets
- `step_skills`, `step_review_skills`, `context_skills` as top-level config
- Skill manifest as separate file
- XState machine generation
- Hand-rolled expression parser/evaluator/DAG resolver
- Completed steps tracking (artifacts ARE the state)

## What's Added

- toposort + jexl as core libraries
- Steps as top-level named definitions
- User-defined types in config
- `tx run <step> <issue>` for direct step execution
- Partials as unified concept (concurrent, pull, multi-step outputs)
- `concurrent` + `reduce` for fan-out/join
- `approved_by` sugar for review-gated steps
- Non-destructive result invalidation with history
- Splat merging (`"..."`) for workflow step overrides
- Context vars (static in config, dynamic from step outputs)
- After hooks (flush, commit as AgentActions)
- Pull/push for issue nesting with artifact partial folding
- `tx flush`, `tx reset`, `tx reset --hard`
- `tx skill <name>` for direct skill triggering
- `tx wizard` for interactive config building
- Tags on issues (freeform, replaces blocked/archived statuses)
- Issue delete (hard delete)
- JSON data dump on idle shutdown
- Per-issue projection directories with open/closed routing
- NOTES.md, ISSUES.md, and artifact projections per root issue
- Skills section with inline, file, package, and plugin references

## Config Validation

Validate config on load, collecting all errors before returning.

Checks:
- **Step references** — workflow step names must reference defined steps
- **DAG cycles** — requires/outputs graph must be acyclic (via toposort)
- **Expression syntax** — `done_when` expressions must parse as valid jexl
- **Skill references** — `uses` values must reference defined skills or
  resolvable package paths
- **Type references** — type workflow references must exist
- **Artifact conflicts** — warn if multiple steps output the same artifact
  without `reduce` defined
- **Required fields** — steps need at least `outputs`, workflows need `steps`
- **Splat validation** — `"..."` only valid in array fields

Result type: `{ ok: true, config: ValidConfig } | { ok: false, errors: ConfigError[] }`

Branded `ValidConfig` type prevents passing unvalidated config to the engine.

## Order of Operations

1. Schema changes (new data model, drop cycles/sessions tables)
2. Add toposort + jexl dependencies
3. New engine loop (toposort + jexl + invalidation)
4. Steps as top-level config, workflow references, splat merging
5. Partials + reduce system
6. Issue hierarchy (pull/push, root vs sub-issue)
7. New CLI commands (run, flush, reset, skill, wizard, pull, push)
8. Projection layout (open/closed dirs, per-issue folders, artifact files)
9. Remove old code (cycles, old engine, XState, expression parser)
10. Config schema update (types, skills, steps, workflows)
11. tx init / tx wizard rewrite
12. Full test rewrite
13. README + docs update
