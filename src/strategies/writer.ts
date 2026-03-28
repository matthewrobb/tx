/**
 * Strategy-aware artifact writer.
 *
 * Given a tracking strategy, writes artifacts in the correct format
 * and location. This is the functional core that skills invoke.
 *
 * All paths are resolved relative to `projectRoot`. For tests, set
 * projectRoot to `.test-output/`. For production, use `.` (cwd).
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, resolve, isAbsolute } from "path";
import type { TrackingStrategy } from "../../types/tracking.js";
import type { ResearchFrontmatter } from "../../types/frontmatter.js";
import type { RequirementsFrontmatter, IssuesFrontmatter, PlanFrontmatter } from "../../types/frontmatter.js";
import type { Issue, IssueGroup, DependencyGraph } from "../../types/issues.js";
import type { NimbalystPlanFrontmatter } from "../../types/nimbalyst.js";
import type { NimbalystConfig } from "../../types/nimbalyst.js";
import { inferPlanType } from "../state/status.js";
import { getArtifactPaths } from "./paths.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

/** Resolve a path relative to project root. Absolute paths pass through. */
function res(path: string, root: string): string {
  return isAbsolute(path) ? path : resolve(root, path);
}

function writeMd(path: string, frontmatter: Record<string, unknown>, body: string): void {
  ensureDir(path);
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.length === 0) return `${k}: []`;
        return `${k}:\n${v.map((i) => `  - ${typeof i === "object" ? JSON.stringify(i) : i}`).join("\n")}`;
      }
      if (v === null) return `${k}: null`;
      if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${v}`;
    })
    .join("\n");
  writeFileSync(path, `---\n${fm}\n---\n\n${body}\n`, "utf-8");
}

function generateULID(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${time}${rand}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Writer options — shared across all write functions
// ---------------------------------------------------------------------------

export interface WriteOptions {
  /** Project root for resolving relative paths. Default: "." */
  projectRoot?: string;
  /** Nimbalyst-specific config (priority, owner). */
  nimbalystConfig?: NimbalystConfig;
}

// ---------------------------------------------------------------------------
// Research writing
// ---------------------------------------------------------------------------

export interface ResearchAgent {
  agentNumber: number;
  focus: string;
  findings: string;
  keyFiles: string[];
  patterns: string[];
  concerns: string[];
}

export function writeResearch(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
  agents: ResearchAgent[],
  opts: WriteOptions = {},
): string[] {
  const root = opts.projectRoot ?? ".";
  const paths = getArtifactPaths(strategy, objective, objDir);
  const written: string[] = [];

  switch (strategy) {
    case "twisted": {
      for (const agent of agents) {
        const p = res(
          typeof paths.research === "function" ? paths.research(agent.agentNumber) : paths.research,
          root,
        );
        const fm: ResearchFrontmatter = {
          objective,
          agent_number: agent.agentNumber,
          focus: agent.focus,
          created: today(),
          status: "done",
        };
        const body = [
          `## Agent ${agent.agentNumber} — ${agent.focus}`,
          "",
          "### Findings",
          agent.findings,
          "",
          "### Key Files",
          ...agent.keyFiles.map((f) => `- ${f}`),
          "",
          "### Patterns",
          ...agent.patterns.map((p) => `- ${p}`),
          "",
          "### Concerns",
          ...agent.concerns.map((c) => `- ${c}`),
        ].join("\n");
        writeMd(p, fm as unknown as Record<string, unknown>, body);
        written.push(p);
      }
      break;
    }

    case "nimbalyst": {
      const p = res(paths.research as string, root);
      const nc = opts.nimbalystConfig;
      const fm: NimbalystPlanFrontmatter = {
        planId: `plan-${objective}`,
        title: objective.replace(/-/g, " "),
        status: "draft",
        planType: inferPlanType(agents.map((a) => a.findings).join(" ")),
        priority: nc?.default_priority ?? "medium",
        owner: nc?.default_owner ?? "claude",
        stakeholders: [],
        tags: [],
        created: today(),
        updated: now(),
        progress: 0,
      };
      const body = [
        `# ${objective.replace(/-/g, " ")}`,
        "",
        "## Goals",
        ...agents.map((a) => `- ${a.focus}: ${a.findings.split(".")[0]}`),
        "",
        "## Problem Description",
        ...agents.flatMap((a) => [
          `### ${a.focus}`,
          a.findings,
          "",
          "**Key files:** " + a.keyFiles.join(", "),
          "**Concerns:** " + a.concerns.join("; "),
          "",
        ]),
      ].join("\n");
      writeMd(p, fm as unknown as Record<string, unknown>, body);
      written.push(p);
      break;
    }

    case "gstack": {
      const p = res(paths.design!, root);
      const body = [
        `# ${objective.replace(/-/g, " ")}`,
        "",
        "## Vision",
        agents.map((a) => a.findings).join("\n\n"),
        "",
        "## Constraints",
        ...agents.flatMap((a) => a.concerns.map((c) => `- ${c}`)),
        "",
        "## Alternatives Explored",
        "",
        "## Detailed Design",
        ...agents.flatMap((a) => [
          `### ${a.focus}`,
          "",
          "**Key files:** " + a.keyFiles.join(", "),
          "**Patterns:** " + a.patterns.join(", "),
          "",
        ]),
      ].join("\n");
      writeMd(p, { status: "ACTIVE" }, body);
      written.push(p);
      break;
    }
  }

  return written;
}

// ---------------------------------------------------------------------------
// Requirements writing
// ---------------------------------------------------------------------------

export function writeRequirements(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
  categories: Record<string, string[]>,
  opts: WriteOptions = {},
): string[] {
  const root = opts.projectRoot ?? ".";
  const paths = getArtifactPaths(strategy, objective, objDir);
  const written: string[] = [];
  const catNames = Object.keys(categories);

  switch (strategy) {
    case "twisted": {
      const p = res(paths.requirements, root);
      const fm: RequirementsFrontmatter = {
        objective,
        created: today(),
        updated: now(),
        categories_completed: catNames,
        categories_remaining: [],
        complete: true,
      };
      const body = catNames
        .map((cat) => [
          `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
          "",
          ...categories[cat]!.map((r) => `- ${r}`),
        ].join("\n"))
        .join("\n\n");
      writeMd(p, fm as unknown as Record<string, unknown>, body);
      written.push(p);
      break;
    }

    case "nimbalyst": {
      const p = res(paths.requirements, root);
      if (existsSync(p)) {
        const existing = readFileSync(p, "utf-8");
        const reqSection = [
          "",
          "## Acceptance Criteria",
          ...(categories.acceptance ?? []).map((r) => `- ${r}`),
          "",
          "## Key Components",
          ...(categories.scope ?? []).map((r) => `- ${r}`),
          "",
          "## Behavioral Requirements",
          ...(categories.behavior ?? []).map((r) => `- ${r}`),
          "",
          "## Constraints",
          ...(categories.constraints ?? []).map((r) => `- ${r}`),
        ].join("\n");
        const updated = existing.replace(/status: draft/, "status: ready-for-development");
        writeFileSync(p, updated + reqSection + "\n", "utf-8");
      }
      written.push(p);
      break;
    }

    case "gstack": {
      const p = res(paths.requirements, root);
      if (existsSync(p)) {
        const existing = readFileSync(p, "utf-8");
        const reqSection = [
          "",
          "## Scope",
          ...(categories.scope ?? []).map((r) => `- ${r}`),
          "",
          "## Acceptance Criteria",
          ...(categories.acceptance ?? []).map((r) => `- ${r}`),
        ].join("\n");
        writeFileSync(p, existing + reqSection + "\n", "utf-8");
      }
      written.push(p);
      break;
    }
  }

  return written;
}

// ---------------------------------------------------------------------------
// Issues + Plan writing
// ---------------------------------------------------------------------------

export function writeIssuesAndPlan(
  strategy: TrackingStrategy,
  objective: string,
  objDir: string,
  allIssues: Issue[],
  groups: IssueGroup[],
  graph: DependencyGraph,
  opts: WriteOptions = {},
): string[] {
  const root = opts.projectRoot ?? ".";
  const paths = getArtifactPaths(strategy, objective, objDir);
  const written: string[] = [];

  switch (strategy) {
    case "twisted": {
      const issuesPath = res(paths.issues!, root);
      const planPath = res(paths.plan, root);

      const issuesFm: IssuesFrontmatter = {
        objective,
        created: today(),
        updated: now(),
        total_issues: allIssues.length,
        issues_done: 0,
        total_groups: groups.length,
        estimation_scale: "fibonacci",
      };
      const issuesBody = groups.map((g) => [
        `## Group ${g.number}`,
        g.depends_on.length ? `Depends on: ${g.depends_on.map((d) => `Group ${d}`).join(", ")}` : "",
        "",
        ...g.issues.map((issue) => [
          `### [${issue.id}] ${issue.title}`,
          `- **Type**: ${issue.type}`,
          `- **Area**: ${issue.area}`,
          `- **File**: ${issue.file}`,
          `- **Current state**: ${issue.current_state}`,
          `- **Target state**: ${issue.target_state}`,
          `- **Dependencies**: ${issue.dependencies.length ? issue.dependencies.join(", ") : "none"}`,
          `- **Complexity**: ${issue.complexity.label} (${issue.complexity.assignment})`,
          `- [${issue.done ? "x" : " "}] Done`,
        ].join("\n")),
      ].flat().join("\n\n")).join("\n\n");
      writeMd(issuesPath, issuesFm as unknown as Record<string, unknown>, issuesBody);
      written.push(issuesPath);

      const executionOrder = computeExecutionOrder(groups);
      const planFm: PlanFrontmatter = {
        objective,
        created: today(),
        updated: now(),
        total_groups: groups.length,
        total_agents: graph.total_agents,
        execution_order: executionOrder,
      };
      const planBody = [
        "## Dependency Graph",
        "",
        ...groups.map((g) => {
          const deps = g.depends_on.length ? ` (after ${g.depends_on.map((d) => `Group ${d}`).join(", ")})` : "";
          const par = g.parallel_with.length ? ` [parallel with ${g.parallel_with.map((p) => `Group ${p}`).join(", ")}]` : "";
          return `- **Group ${g.number}**${deps}${par}: ${g.issues.map((i) => i.id).join(", ")}`;
        }),
        "",
        "## Execution Order",
        "",
        ...executionOrder.map((batch, i) => `${i + 1}. ${batch.map((g) => `Group ${g}`).join(" + ")}`),
        "",
        "## Agent Summary",
        "",
        `- Batched: ${graph.batched_agents}`,
        `- Standard: ${graph.standard_agents}`,
        `- Split: ${graph.split_agents}`,
        `- **Total: ${graph.total_agents}**`,
      ].join("\n");
      writeMd(planPath, planFm as unknown as Record<string, unknown>, planBody);
      written.push(planPath);
      break;
    }

    case "nimbalyst": {
      const planPath = res(paths.plan, root);
      const nc = opts.nimbalystConfig;

      if (existsSync(planPath)) {
        const existing = readFileSync(planPath, "utf-8");
        const checklist = [
          "",
          "## Implementation Progress",
          "",
          ...allIssues.map((i) => `- [${i.done ? "x" : " "}] ${i.id}: ${i.title}`),
        ].join("\n");
        const updated = existing.replace(/progress: \d+/, "progress: 0");
        writeFileSync(planPath, updated + checklist + "\n", "utf-8");
      }
      written.push(planPath);

      if (paths.tracker) {
        const trackerPath = res(paths.tracker, root);
        ensureDir(trackerPath);
        const trackerItems = allIssues.map((i) => {
          const type = i.type === "bug" ? "bug" : "task";
          const ulid = generateULID();
          return `- [${i.id}] ${i.title} #${type}[id:${type}_${ulid} status:to-do priority:${nc?.default_priority ?? "medium"} created:${today()}]`;
        }).join("\n");
        writeFileSync(trackerPath, trackerItems + "\n", "utf-8");
        written.push(trackerPath);
      }
      break;
    }

    case "gstack": {
      const issuesPath = res(paths.issues!, root);
      const planPath = res(paths.plan, root);

      const issuesFm: IssuesFrontmatter = {
        objective,
        created: today(),
        updated: now(),
        total_issues: allIssues.length,
        issues_done: 0,
        total_groups: groups.length,
        estimation_scale: "fibonacci",
      };
      const issuesBody = groups.map((g) =>
        g.issues.map((i) => `### [${i.id}] ${i.title}\n- [${i.done ? "x" : " "}] Done`).join("\n\n"),
      ).join("\n\n");
      writeMd(issuesPath, issuesFm as unknown as Record<string, unknown>, issuesBody);
      written.push(issuesPath);

      const planBody = [
        `# ${objective.replace(/-/g, " ")}`,
        "",
        "## Problem Statement",
        "See DESIGN.md for full context.",
        "",
        "## Approach",
        `Break into ${groups.length} execution groups with ${graph.total_agents} agents.`,
        "",
        "## Scope",
        ...allIssues.map((i) => `- ${i.id}: ${i.title}`),
        "",
        "## Architecture",
        "Component changes driven by issue breakdown. See ISSUES.md for details.",
        "",
        "## Implementation",
        ...groups.map((g) => {
          const deps = g.depends_on.length ? ` (after ${g.depends_on.join(", ")})` : "";
          return [`### Group ${g.number}${deps}`, ...g.issues.map((i) => `${i.id}. ${i.title}`)].join("\n");
        }),
        "",
        "## Risks & Mitigations",
        "See DESIGN.md constraints section.",
        "",
        "## Acceptance Criteria",
        "See DESIGN.md acceptance criteria section.",
      ].join("\n");
      writeMd(planPath, { name: objective, version: "1.0.0", description: `Plan for ${objective}` }, planBody);
      written.push(planPath);
      break;
    }
  }

  return written;
}

// ---------------------------------------------------------------------------
// Multi-strategy writing
// ---------------------------------------------------------------------------

export function writeAllStrategies(
  strategies: TrackingStrategy[],
  writer: (strategy: TrackingStrategy) => string[],
): string[] {
  return strategies.flatMap(writer);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computeExecutionOrder(groups: IssueGroup[]): number[][] {
  const order: number[][] = [];
  const completed = new Set<number>();

  while (completed.size < groups.length) {
    const batch = groups
      .filter((g) => !completed.has(g.number))
      .filter((g) => g.depends_on.every((d) => completed.has(d)))
      .map((g) => g.number);

    if (batch.length === 0) break;
    order.push(batch);
    batch.forEach((n) => completed.add(n));
  }

  return order;
}
