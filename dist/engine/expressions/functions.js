// src/engine/expressions/functions.ts — Built-in synchronous functions
//
// Only deterministic, side-effect-free functions belong here.
// Interactive functions (confirm, prompt, choose) are S-006 and produce
// pause/resume semantics — they are NOT registered here.
//
// Functions take Json arguments and return EvalResult. This uniform signature
// means the evaluator doesn't need special-case logic per function.
/**
 * Create the default set of built-in functions.
 *
 * Returns a new Map each time so callers can extend without mutating a shared
 * registry (important for testability and plugin isolation).
 */
export function createBuiltinFunctions() {
    const fns = new Map();
    // defined(value) — true if value is not null/undefined.
    // Since our expression system uses Json (no `undefined`), null is the only
    // "not defined" sentinel. The evaluator returns null for missing context keys.
    fns.set('defined', (...args) => {
        if (args.length !== 1) {
            return { ok: false, error: `defined() expects 1 argument, got ${args.length}` };
        }
        return { ok: true, value: args[0] !== null };
    });
    // not_empty(value) — true if value is a non-empty string, array, or object.
    // Returns false for null, numbers, booleans, empty strings, empty arrays,
    // and objects with no own keys.
    fns.set('not_empty', (...args) => {
        if (args.length !== 1) {
            return { ok: false, error: `not_empty() expects 1 argument, got ${args.length}` };
        }
        const val = args[0];
        if (val === null)
            return { ok: true, value: false };
        if (typeof val === 'string')
            return { ok: true, value: val.length > 0 };
        if (Array.isArray(val))
            return { ok: true, value: val.length > 0 };
        if (typeof val === 'object')
            return { ok: true, value: Object.keys(val).length > 0 };
        // Numbers and booleans are considered "not empty" — they're scalar values
        // with meaning. This avoids confusing `not_empty(0)` → false.
        return { ok: true, value: false };
    });
    // includes(array, item) — true if array contains item (shallow equality).
    // Uses JSON.stringify comparison for non-primitive values — this is intentional
    // because our value domain is Json, and structural equality matches user intent
    // better than reference equality.
    fns.set('includes', (...args) => {
        if (args.length !== 2) {
            return { ok: false, error: `includes() expects 2 arguments, got ${args.length}` };
        }
        const arr = args[0];
        const item = args[1];
        if (!Array.isArray(arr)) {
            return { ok: false, error: 'includes() first argument must be an array' };
        }
        // For primitives, use direct comparison. For objects/arrays, use JSON serialization.
        const found = arr.some((el) => jsonEqual(el, item));
        return { ok: true, value: found };
    });
    // count(array) — length of array, or null if not an array.
    // Returns null (not error) for non-arrays because expressions like
    // count(maybe_list) should propagate nulls gracefully.
    fns.set('count', (...args) => {
        if (args.length !== 1) {
            return { ok: false, error: `count() expects 1 argument, got ${args.length}` };
        }
        const val = args[0];
        if (!Array.isArray(val))
            return { ok: true, value: null };
        return { ok: true, value: val.length };
    });
    return fns;
}
/**
 * Deep equality for Json values using serialization.
 *
 * This is correct for our domain because all values are Json (no undefined,
 * no functions, no symbols, no circular references). For primitives it
 * short-circuits without serializing.
 */
function jsonEqual(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (typeof a !== typeof b)
        return false;
    if (typeof a !== 'object')
        return false;
    return JSON.stringify(a) === JSON.stringify(b);
}
//# sourceMappingURL=functions.js.map