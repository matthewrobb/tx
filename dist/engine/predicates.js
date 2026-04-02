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
const registry = {
    "artifact.exists"(args, { epicDir }) {
        const path = args["path"];
        if (!path)
            return false;
        return existsSync(join(epicDir, path));
    },
    "tasks.all_done"(_args, { epicDir }) {
        const tasksPath = join(epicDir, "tasks.json");
        if (!existsSync(tasksPath))
            return false;
        const tasks = JSON.parse(readFileSync(tasksPath, "utf-8"));
        return tasks.length > 0 && tasks.every((t) => t.done);
    },
    "lane.exists"(args, { twistedRoot }) {
        const dir = args["dir"];
        if (!dir)
            return false;
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
export function evaluatePredicate(predicate, ctx) {
    const fn = registry[predicate.name];
    if (!fn)
        return false;
    return fn(predicate.args ?? {}, ctx);
}
/**
 * Evaluate a list of predicates — all must pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export function evaluateAllPredicates(predicates, ctx) {
    return predicates.every((p) => evaluatePredicate(p, ctx));
}
/**
 * Return the names of predicates that do NOT pass.
 *
 * @param predicates - Predicates to evaluate.
 * @param ctx - Evaluation context.
 */
export function failingPredicates(predicates, ctx) {
    return predicates.filter((p) => !evaluatePredicate(p, ctx)).map((p) => p.name);
}
//# sourceMappingURL=predicates.js.map