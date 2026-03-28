import { describe, test, expect } from "bun:test";
import { toNimbalystStatus, inferPlanType, toTrackerStatus, calculateProgress } from "./status.js";

describe("toNimbalystStatus", () => {
  test("blocked maps to blocked", () => {
    expect(toNimbalystStatus("blocked", "execute")).toBe("blocked");
  });

  test("done maps to completed", () => {
    expect(toNimbalystStatus("done", "ship")).toBe("completed");
  });

  test("research/scope maps to draft", () => {
    expect(toNimbalystStatus("todo", "research")).toBe("draft");
    expect(toNimbalystStatus("todo", "scope")).toBe("draft");
  });

  test("decompose maps to ready-for-development", () => {
    expect(toNimbalystStatus("todo", "decompose")).toBe("ready-for-development");
  });

  test("execute maps to in-development", () => {
    expect(toNimbalystStatus("in-progress", "execute")).toBe("in-development");
  });

  test("code_review/qa maps to in-review", () => {
    expect(toNimbalystStatus("in-progress", "code_review")).toBe("in-review");
    expect(toNimbalystStatus("in-progress", "qa")).toBe("in-review");
  });
});

describe("inferPlanType", () => {
  test("bug keywords", () => {
    expect(inferPlanType("fix the login bug")).toBe("bug-fix");
  });

  test("refactor keywords", () => {
    expect(inferPlanType("refactor auth middleware")).toBe("refactor");
  });

  test("research keywords", () => {
    expect(inferPlanType("investigate performance issues")).toBe("research");
  });

  test("defaults to feature", () => {
    expect(inferPlanType("add user profiles")).toBe("feature");
  });
});

describe("toTrackerStatus", () => {
  test("done issue", () => {
    expect(toTrackerStatus(true)).toBe("done");
  });

  test("in-progress issue", () => {
    expect(toTrackerStatus(false, true)).toBe("in-progress");
  });

  test("todo issue", () => {
    expect(toTrackerStatus(false, false)).toBe("to-do");
  });
});

describe("calculateProgress", () => {
  test("zero total", () => {
    expect(calculateProgress(0, null)).toBe(0);
    expect(calculateProgress(0, 0)).toBe(0);
  });

  test("partial progress", () => {
    expect(calculateProgress(2, 5)).toBe(40);
    expect(calculateProgress(1, 3)).toBe(33);
  });

  test("complete", () => {
    expect(calculateProgress(5, 5)).toBe(100);
  });
});
