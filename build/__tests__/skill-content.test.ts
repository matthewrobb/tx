// build/__tests__/skill-content.test.ts
import { describe, it, expect } from "bun:test";
import { twistedWork } from "../skills/twisted-work.ts";
import { buildSkillContent } from "../lib/skill.ts";

describe("twisted-work content", () => {
  let content: string;

  it("setup", () => {
    content = buildSkillContent(twistedWork);
    expect(content).toBeDefined();
  });

  it("has user-invocable: true", () => {
    expect(content).toContain("user-invocable: true");
  });

  it("documents tx commands", () => {
    expect(content).toContain("tx");
  });

  it("documents open and close commands", () => {
    expect(content).toContain("open");
    expect(content).toContain("close");
  });

  it("documents --agent flag", () => {
    expect(content).toContain("--agent");
  });

  it("documents AgentResponse", () => {
    expect(content).toContain("AgentResponse");
  });

  it("documents 5-step pipeline", () => {
    expect(content).toContain("research");
    expect(content).toContain("scope");
    expect(content).toContain("plan");
    expect(content).toContain("build");
    expect(content).toContain("close");
  });
});

