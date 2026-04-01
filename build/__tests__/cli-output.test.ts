// build/__tests__/cli-output.test.ts
import { describe, it, expect } from "bun:test";
import { formatAgent, formatHuman } from "../../src/cli/output.ts";
import type { AgentResponse } from "../../types/output";

describe("formatAgent", () => {
  it("serializes AgentResponse as JSON", () => {
    const response: AgentResponse = {
      status: "ok",
      command: "status",
      display: "All good",
    };
    const output = formatAgent(response);
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe("ok");
    expect(parsed.command).toBe("status");
  });
});

describe("formatHuman", () => {
  it("returns display field when present", () => {
    const response: AgentResponse = {
      status: "ok",
      command: "status",
      display: "## Status\nAll objectives clear.",
    };
    expect(formatHuman(response)).toContain("All objectives clear.");
  });

  it("shows error for error status", () => {
    const response: AgentResponse = {
      status: "error",
      command: "next",
      error: "No active objective",
    };
    expect(formatHuman(response)).toContain("No active objective");
  });

  it("shows pause message for paused status", () => {
    const response: AgentResponse = {
      status: "paused",
      command: "next",
      action: { type: "confirm", message: "Settings change", next_command: "tx next" },
    };
    expect(formatHuman(response)).toContain("Settings change");
  });
});
