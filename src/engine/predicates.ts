/**
 * Predicate evaluator — named boolean conditions used in step exit_when and lane entry_requires.
 *
 * Built-in predicates:
 *   artifact.exists   — file exists at the given path
 *   tasks.all_done    — all tasks in tasks.json are marked done
 *   lane.exists       — the given lane directory exists under .twisted/
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { PredicateRef, Task } from "../types/index.js";

/** Context passed to every predicate. */
export interface PredicateContext {
  /** Absolute path to the epic's current lane directory. */
  epicDir: string;
  /** Absolute path to the .twisted/ root. */
  twistedRoot: string;
}

type PredicateFn = (args: Record<string, unknown>, ctx: PredicateContext) => boolean;

const registry: Record<string, PredicateFn> = {
  "artifact.exists"(args, { epicDir }) {
    const path = args["path"] as string | undefined;
    if (!path) return false;
    return existsSync(join(epicDir, path));
  },

  "tasks.all_done"(_args, { epicDir }) {
    const tasksPath = join(epicDir, "tasks.json");
    if (!existsSync(tasksPath)) return false;
    const tasks: Task[] = JSON.parse(readFileSync(tasksPath, "utf-8"));
    return tasks.length > 0 && tasks.every((t) => t.done);
  },

  "lane.exists"(args, { twistedRoot }) {
    const dir = args["dir"] as string | undefined;
    if (!dir) return false;
    return existsSync(join(twistedRoot, dir));
  },
};

/**
 * Evaluate a single predicate reference.
 *
 * @param predicate - The predicate to evaluate.
 * @param ctx - Evaluation context (epicDir, twistedRoot).
 * @returns True if the predicate passes, false otherwise.
 */
export function evaluatePredicate(predicate: PredicateRef, ctx: PredicateContext): boolean {
  const fn = registry[predicate.name];
  if (!fn) return false;
  return fn(predicate.args ?? {}, ctx);
}

/**
 * Evaluate a list of predicates — all must pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export function evaluateAllPredicates(predicates: PredicateRef[], ctx: PredicateContext): boolean {
  return predicates.every((p) => evaluatePredicate(p, ctx));
}

/**
 * Return the names of predicates that do NOT pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export function failingPredicates(predicates: PredicateRef[], ctx: PredicateContext): string[] {
  return predicates.filter((p) => !evaluatePredicate(p, ctx)).map((p) => p.name);
}
