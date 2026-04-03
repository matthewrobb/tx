/**
 * Config validator — validates a resolved TwistedConfig and brands it as ValidConfig.
 *
 * Collects ALL errors before returning (never short-circuits on first error).
 * Returns a discriminated union: { ok: true, config: ValidConfig } | { ok: false, errors }.
 *
 * Validation order:
 *   1. Version check
 *   2. Duplicate workflow IDs
 *   3. Extends chain resolution (unknown refs + cycles)
 *   4. DAG validity per workflow
 *   5. Expression syntax in step conditions
 */
import type { TwistedConfig, ValidConfig } from '../types/config.js';
export type ConfigError = {
    kind: 'missing_field';
    path: string;
} | {
    kind: 'invalid_version';
    found: string;
} | {
    kind: 'duplicate_workflow_id';
    id: string;
} | {
    kind: 'invalid_expression';
    workflow: string;
    step: string;
    field: string;
    error: string;
} | {
    kind: 'dag_cycle';
    workflow: string;
    cycles: string[][];
} | {
    kind: 'extends_cycle';
    chain: string[];
} | {
    kind: 'unknown_extends';
    workflow: string;
    extends_id: string;
};
export type ValidatedResult = {
    ok: true;
    config: ValidConfig;
} | {
    ok: false;
    errors: ConfigError[];
};
export declare function validateConfig(config: TwistedConfig): ValidatedResult;
//# sourceMappingURL=validator.d.ts.map