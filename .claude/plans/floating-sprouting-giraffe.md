# Plan: Build System + Tracking Strategies + JSON Schema

## Context

Three interconnected changes:

1. **Build system** — TypeScript source in `src/` compiled to SKILL.md, preset JSON, and JSON Schema via Bun. Eta templates + build-md for markdown generation. Generated files committed to git.

2. **Tracking strategies** — `tracking: ["twisted"]` array determines artifact formats across the full pipeline. First entry = primary. All entries written.

3. **JSON Schema** — Generated `schemas/settings.schema.json` for VS Code autocomplete.

## Tech Stack

- **Bun** — build runtime, native TypeScript
- **Eta** — template engine for skill content (.eta files), partials/includes, `functionHeader` for global helpers
- **build-md** — markdown DSL (`md` tagged template + `MarkdownDocument`) available inside Eta via functionHeader
- **TypeScript** — build script, presets, schema generator, type-checked against `types/`

## Execution Order

1. Initialize Bun project, install deps (eta, build-md)
2. Types: `tracking.d.ts`, update `config.d.ts`, `nimbalyst.d.ts`, `preset.d.ts`
3. Build infrastructure: `src/lib/`, `src/build.ts`
4. Move skill content into `src/skills/` as .eta templates + .ts logic
5. Move presets into `src/presets/` as typed objects
6. Add tracking strategy logic
7. JSON Schema generator
8. Build, verify output, delete standalone preset
9. Update README, CLAUDE.md
10. Bump to 2.2.0
