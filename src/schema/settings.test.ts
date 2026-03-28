import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateSchema } from "./settings.js";

const ROOT = resolve(import.meta.dirname, "../..");

describe("generateSchema", () => {
  test("produces valid JSON Schema", () => {
    const schema = generateSchema();
    expect(schema).toHaveProperty("$schema");
    expect(schema).toHaveProperty("title", "twisted-workflow settings");
    expect(schema).toHaveProperty("type", "object");
    expect(schema).toHaveProperty("properties");
  });

  test("has all top-level config sections", () => {
    const schema = generateSchema() as any;
    const keys = Object.keys(schema.properties);
    expect(keys).toContain("$schema");
    expect(keys).toContain("presets");
    expect(keys).toContain("tracking");
    expect(keys).toContain("tools");
    expect(keys).toContain("pipeline");
    expect(keys).toContain("execution");
    expect(keys).toContain("phases");
    expect(keys).toContain("decompose");
    expect(keys).toContain("templates");
    expect(keys).toContain("state");
    expect(keys).toContain("flow");
    expect(keys).toContain("writing");
    expect(keys).toContain("nimbalyst");
    expect(keys).toContain("directories");
    expect(keys).toContain("files");
    expect(keys).toContain("naming");
    expect(keys).toContain("strings");
    expect(keys).toContain("context_skills");
  });

  test("presets has enum with built-in names", () => {
    const schema = generateSchema() as any;
    const presetItems = schema.properties.presets.items;
    const enumValues = presetItems.anyOf[0].enum;
    expect(enumValues).toContain("twisted");
    expect(enumValues).toContain("superpowers");
    expect(enumValues).toContain("gstack");
    expect(enumValues).toContain("nimbalyst");
    expect(enumValues).toContain("minimal");
    expect(enumValues).not.toContain("standalone");
  });

  test("tracking has enum with built-in strategies", () => {
    const schema = generateSchema() as any;
    const trackingItems = schema.properties.tracking.items;
    const enumValues = trackingItems.anyOf[0].enum;
    expect(enumValues).toContain("twisted");
    expect(enumValues).toContain("nimbalyst");
    expect(enumValues).toContain("gstack");
  });

  test("execution.strategy has correct enum", () => {
    const schema = generateSchema() as any;
    const strategy = schema.properties.execution.properties.strategy;
    expect(strategy.enum).toEqual(["task-tool", "agent-teams", "manual", "auto"]);
  });

  test("execution.worktree_tiers has correct enum", () => {
    const schema = generateSchema() as any;
    const tiers = schema.properties.execution.properties.worktree_tiers;
    expect(tiers.enum).toEqual([1, 2, 3]);
  });

  test("phases have model/effort/context/mode", () => {
    const schema = generateSchema() as any;
    for (const phase of ["scope", "decompose", "execute"]) {
      const props = schema.properties.phases.properties[phase].properties;
      expect(props.model.enum).toContain("opus");
      expect(props.model.enum).toContain("sonnet");
      expect(props.effort.enum).toContain("max");
      expect(props.context.enum).toContain("1m");
      expect(props.mode.enum).toContain("plan");
    }
  });

  test("pipeline phases have provider/fallback/options", () => {
    const schema = generateSchema() as any;
    for (const phase of ["research", "arch_review", "code_review", "qa", "ship"]) {
      const props = schema.properties.pipeline.properties[phase].properties;
      expect(props).toHaveProperty("provider");
      expect(props).toHaveProperty("fallback");
      expect(props).toHaveProperty("options");
    }
  });

  test("nimbalyst has priority enum", () => {
    const schema = generateSchema() as any;
    const priority = schema.properties.nimbalyst.properties.default_priority;
    expect(priority.enum).toEqual(["low", "medium", "high", "critical"]);
  });
});

describe("generated schema file", () => {
  test("schemas/settings.schema.json exists and is valid", () => {
    const content = readFileSync(resolve(ROOT, "schemas/settings.schema.json"), "utf-8");
    const schema = JSON.parse(content);
    expect(schema.title).toBe("twisted-workflow settings");
  });

  test("matches generateSchema() output", () => {
    const content = readFileSync(resolve(ROOT, "schemas/settings.schema.json"), "utf-8");
    const fromFile = JSON.parse(content);
    const fromCode = generateSchema();
    expect(fromFile).toEqual(fromCode);
  });
});
