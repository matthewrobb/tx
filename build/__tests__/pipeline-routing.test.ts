import { describe, test, expect } from "vitest";
import { parseProvider, hasConfigChange, shouldPause, getPhaseSettings } from "../../src/pipeline/routing.js";
import { defaults } from "../../src/config/defaults.js";

describe("parseProvider", () => {
  test("built-in", () => {
    expect(parseProvider("built-in")).toEqual({ type: "built-in" });
  });

  test("skip", () => {
    expect(parseProvider("skip")).toEqual({ type: "skip" });
  });

  test("ask", () => {
    expect(parseProvider("ask")).toEqual({ type: "ask" });
  });

  test("gstack command", () => {
    expect(parseProvider("gstack:/review")).toEqual({
      type: "gstack",
      command: "/review",
    });
  });

  test("superpowers skill", () => {
    expect(parseProvider("superpowers:test-driven-development")).toEqual({
      type: "superpowers",
      skill: "test-driven-development",
    });
  });

  test("nimbalyst skill", () => {
    expect(parseProvider("nimbalyst:deep-researcher")).toEqual({
      type: "nimbalyst",
      skill: "deep-researcher",
    });
  });
});

describe("getPhaseSettings", () => {
  test("core steps have settings", () => {
    expect(getPhaseSettings("scope", defaults.phases)).not.toBeNull();
    expect(getPhaseSettings("plan", defaults.phases)).not.toBeNull();
    expect(getPhaseSettings("build", defaults.phases)).not.toBeNull();
  });

  test("delegatable steps return null", () => {
    expect(getPhaseSettings("research", defaults.phases)).toBeNull();
    expect(getPhaseSettings("code_review", defaults.phases)).toBeNull();
  });
});

describe("hasConfigChange", () => {
  test("scope → plan has mode change", () => {
    // scope is execute mode, plan is plan mode
    expect(hasConfigChange("scope", "plan", defaults.phases)).toBe(true);
  });

  test("plan → build has model + effort + context change", () => {
    expect(hasConfigChange("plan", "build", defaults.phases)).toBe(true);
  });

  test("no change between steps without settings", () => {
    expect(hasConfigChange("research", "scope", defaults.phases)).toBe(false);
  });
});

describe("shouldPause", () => {
  test("yolo skips all pauses", () => {
    expect(
      shouldPause("scope", "plan", defaults.flow, defaults.phases, true),
    ).toBeNull();
  });

  test("auto_advance false always pauses", () => {
    const flow = { ...defaults.flow, auto_advance: false };
    expect(
      shouldPause("scope", "plan", flow, defaults.phases, false),
    ).toBe("user_requested");
  });

  test("config change triggers pause", () => {
    expect(
      shouldPause("scope", "plan", defaults.flow, defaults.phases, false),
    ).toBe("config_change");
  });

  test("no pause between steps without config change", () => {
    // research → scope: neither has phase settings, so no config change
    expect(
      shouldPause("research", "scope", defaults.flow, defaults.phases, false),
    ).toBeNull();
  });
});
