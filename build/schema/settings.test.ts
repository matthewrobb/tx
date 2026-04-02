import { describe, test, expect } from "vitest";
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

  test("has v4 top-level config sections only", () => {
    const schema = generateSchema() as any;
    const keys = Object.keys(schema.properties);
    expect(keys).toContain("$schema");
    expect(keys).toContain("lanes");
    expect(keys).toContain("types");
    expect(keys).toContain("context_skills");
    // v3 fields must not be present
    expect(keys).not.toContain("presets");
    expect(keys).not.toContain("pipeline");
    expect(keys).not.toContain("execution");
    expect(keys).not.toContain("phases");
    expect(keys).not.toContain("state");
    expect(keys).not.toContain("flow");
  });

  test("lanes items have name, dir, steps", () => {
    const schema = generateSchema() as any;
    const laneProps = schema.properties.lanes.items.properties;
    expect(laneProps).toHaveProperty("name");
    expect(laneProps).toHaveProperty("dir");
    expect(laneProps).toHaveProperty("steps");
    expect(laneProps).toHaveProperty("entry_requires");
  });

  test("types items have type enum and lanes array", () => {
    const schema = generateSchema() as any;
    const typeProps = schema.properties.types.items.properties;
    expect(typeProps.type.enum).toEqual(["feature", "bug", "spike", "chore", "release"]);
    expect(typeProps.lanes.type).toBe("array");
  });

  test("step items have produces, requires, exit_when, prompt", () => {
    const schema = generateSchema() as any;
    const stepProps = schema.properties.lanes.items.properties.steps.items.properties;
    expect(stepProps).toHaveProperty("produces");
    expect(stepProps).toHaveProperty("requires");
    expect(stepProps).toHaveProperty("exit_when");
    expect(stepProps).toHaveProperty("prompt");
  });

  test("context_skills is a string array", () => {
    const schema = generateSchema() as any;
    expect(schema.properties.context_skills.type).toBe("array");
    expect(schema.properties.context_skills.items.type).toBe("string");
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
