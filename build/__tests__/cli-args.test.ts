// build/__tests__/cli-args.test.ts
import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli/args.ts";

describe("parseArgs", () => {
  it("parses tx open my-feature", () => {
    const cmd = parseArgs(["open", "my-feature"]);
    expect(cmd.subcommand).toBe("open");
    expect(cmd.params).toEqual({ epic: "my-feature" });
    expect(cmd.flags.agent).toBe(false);
  });

  it("parses tx open my-feature --type bug", () => {
    const cmd = parseArgs(["open", "my-feature", "--type", "bug"]);
    expect(cmd.params).toEqual({ epic: "my-feature", type: "bug" });
  });

  it("parses tx next -a", () => {
    const cmd = parseArgs(["next", "-a"]);
    expect(cmd.subcommand).toBe("next");
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses tx close my-feature -y", () => {
    const cmd = parseArgs(["close", "my-feature", "-y"]);
    expect(cmd.subcommand).toBe("close");
    expect(cmd.params).toEqual({ epic: "my-feature" });
    expect(cmd.flags.yolo).toBe(true);
  });

  it("parses -e flag", () => {
    const cmd = parseArgs(["next", "-e", "my-epic", "-a"]);
    expect(cmd.flags.epic).toBe("my-epic");
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses tx config pipeline research", () => {
    const cmd = parseArgs(["config", "pipeline", "research"]);
    expect(cmd.subcommand).toBe("config");
    expect(cmd.params).toEqual({ section: "pipeline", subsection: "research" });
  });

  it("parses tx write scope -e my-feature -a", () => {
    const cmd = parseArgs(["write", "scope", "-e", "my-feature", "-a"]);
    expect(cmd.subcommand).toBe("write");
    expect(cmd.params.type).toBe("scope");
    expect(cmd.params.epic).toBe("my-feature");
    expect(cmd.flags.agent).toBe(true);
    expect(cmd.flags.epic).toBe("my-feature");
  });

  it("parses tx tasks add 'Do something'", () => {
    const cmd = parseArgs(["tasks", "add", "Do something"]);
    expect(cmd.subcommand).toBe("tasks");
    expect(cmd.params).toEqual({ action: "add", summary: "Do something" });
  });

  it("parses tx note 'Some note' --decide --reason 'because'", () => {
    const cmd = parseArgs(["note", "Some note", "--decide", "--reason", "because"]);
    expect(cmd.subcommand).toBe("note");
    expect(cmd.params).toEqual({ summary: "Some note", type: "decision", reason: "because" });
  });

  it("parses tx pickup my-session", () => {
    const cmd = parseArgs(["pickup", "my-session"]);
    expect(cmd.subcommand).toBe("pickup");
    expect(cmd.params).toEqual({ name: "my-session" });
  });

  it("parses tx handoff", () => {
    const cmd = parseArgs(["handoff"]);
    expect(cmd.subcommand).toBe("handoff");
    expect(cmd.params).toEqual({ name: undefined });
  });

  it("parses tx session status", () => {
    const cmd = parseArgs(["session", "status"]);
    expect(cmd.subcommand).toBe("session");
    expect(cmd.params).toEqual({ action: "status", name: undefined });
  });

  it("parses tx tasks update T-003 --done", () => {
    const cmd = parseArgs(["tasks", "update", "T-003", "--done"]);
    expect(cmd.subcommand).toBe("tasks");
    expect(cmd.params).toEqual({ action: "update", id: "T-003", done: true });
  });

  it("parses tx research my-feature -a", () => {
    const cmd = parseArgs(["research", "my-feature", "-a"]);
    expect(cmd.subcommand).toBe("research");
    expect(cmd.params).toEqual({ epic: "my-feature" });
    expect(cmd.flags.agent).toBe(true);
  });

  it("parses -v as version", () => {
    const cmd = parseArgs(["-v"]);
    expect(cmd.flags.version).toBe(true);
  });

  it("parses -h as help", () => {
    const cmd = parseArgs(["-h"]);
    expect(cmd.flags.help).toBe(true);
  });
});
