import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateSchema } from "./settings.js";

const ROOT = resolve(import.meta.dirname, "../..");

describe("generateSchema", () => {
  test("produces valid JSON Schema", () => {
    const schema = generateSchema();
    expect(schema).toHaveProperty("$schema");
    expect(schema).toHaveProperty("title", "tx settings");
    expect(schema).toHaveProperty("type", "object");
    expect(schema).toHaveProperty("properties");
  });

  test("has v4 top-level config sections only", () => {
    const schema = generateSchema() as any;
    const keys = Object.keys(schema.properties);
    expect(keys).toContain("$schema");
    expect(keys).toContain("workflows");
    expect(keys).toContain("context_skills");
    expect(keys).toContain("policies");
    // v3 fields must not be present
    expect(keys).not.toContain("lanes");
    expect(keys).not.toContain("types");
  });

  test("workflows items have id and steps", () => {
    const schema = generateSchema() as any;
    const workflowProps = schema.properties.workflows.items.properties;
    expect(workflowProps).toHaveProperty("id");
    expect(workflowProps).toHaveProperty("steps");
    expect(workflowProps).toHaveProperty("default_for");
    expect(workflowProps).toHaveProperty("extends");
  });

  test("policies object has deferral and scope_change", () => {
    const schema = generateSchema() as any;
    const policyProps = schema.properties.policies.properties;
    expect(policyProps).toHaveProperty("deferral");
    expect(policyProps).toHaveProperty("scope_change");
    expect(policyProps).toHaveProperty("decision");
    expect(policyProps).toHaveProperty("issue_create");
  });

  test("step items have id, title, needs, done_when, prompt", () => {
    const schema = generateSchema() as any;
    const stepProps = schema.properties.workflows.items.properties.steps.items.properties;
    expect(stepProps).toHaveProperty("id");
    expect(stepProps).toHaveProperty("title");
    expect(stepProps).toHaveProperty("needs");
    expect(stepProps).toHaveProperty("done_when");
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
    expect(schema.title).toBe("tx settings");
  });

  test("matches generateSchema() output", () => {
    const content = readFileSync(resolve(ROOT, "schemas/settings.schema.json"), "utf-8");
    const fromFile = JSON.parse(content);
    const fromCode = generateSchema();
    expect(fromFile).toEqual(fromCode);
  });
});
