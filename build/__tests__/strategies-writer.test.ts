import { describe, test, expect } from "bun:test";
import { computeExecutionOrder } from "../../src/strategies/writer.js";
import type { IssueGroup } from "../../types/issues.js";

describe("computeExecutionOrder", () => {
  test("single group", () => {
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [], parallel_with: [] },
    ];
    expect(computeExecutionOrder(groups)).toEqual([[1]]);
  });

  test("sequential groups", () => {
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [], parallel_with: [] },
      { number: 2, issues: [], depends_on: [1], parallel_with: [] },
      { number: 3, issues: [], depends_on: [2], parallel_with: [] },
    ];
    expect(computeExecutionOrder(groups)).toEqual([[1], [2], [3]]);
  });

  test("parallel groups (no dependencies)", () => {
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [], parallel_with: [2] },
      { number: 2, issues: [], depends_on: [], parallel_with: [1] },
    ];
    expect(computeExecutionOrder(groups)).toEqual([[1, 2]]);
  });

  test("mixed parallel and sequential", () => {
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [], parallel_with: [2] },
      { number: 2, issues: [], depends_on: [], parallel_with: [1] },
      { number: 3, issues: [], depends_on: [1, 2], parallel_with: [] },
      { number: 4, issues: [], depends_on: [3], parallel_with: [5] },
      { number: 5, issues: [], depends_on: [3], parallel_with: [4] },
    ];
    expect(computeExecutionOrder(groups)).toEqual([[1, 2], [3], [4, 5]]);
  });

  test("diamond dependency", () => {
    // 1 → 2, 1 → 3, 2+3 → 4
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [], parallel_with: [] },
      { number: 2, issues: [], depends_on: [1], parallel_with: [3] },
      { number: 3, issues: [], depends_on: [1], parallel_with: [2] },
      { number: 4, issues: [], depends_on: [2, 3], parallel_with: [] },
    ];
    expect(computeExecutionOrder(groups)).toEqual([[1], [2, 3], [4]]);
  });

  test("circular dependency guard (returns partial result)", () => {
    const groups: IssueGroup[] = [
      { number: 1, issues: [], depends_on: [2], parallel_with: [] },
      { number: 2, issues: [], depends_on: [1], parallel_with: [] },
    ];
    // Should not infinite loop — returns empty since nothing can start
    expect(computeExecutionOrder(groups)).toEqual([]);
  });
});
