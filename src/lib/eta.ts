/**
 * Eta template engine configuration with extraction helpers.
 *
 * Templates have access to:
 * - it.extract(filePath, name) — extract a declaration, wrapped in ts code fence
 * - it.signature(filePath, name) — extract just the signature
 * - it.region(filePath, name) — extract a labeled region
 * - it.table(headers, rows) — build-md table
 * - it.defaults — full TwistedConfig defaults
 */

import { Eta } from "eta";
import { resolve } from "path";
import { embedDeclaration, embedSignature, embedRegion } from "./extract.js";
import { table } from "./markdown.js";
import { defaults } from "../config/defaults.js";
import { resolveReadFirst, formatReadFirst } from "./imports.js";

export function createEta(viewsDir: string): Eta {
  return new Eta({
    views: resolve(viewsDir),
    autoEscape: false,
  });
}

/** Data passed to every Eta template via the `it` object. */
export function templateData(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    extract: embedDeclaration,
    signature: embedSignature,
    region: embedRegion,
    table,
    defaults,
    ...extra,
  };
}

/**
 * Build a skill with automatic "read first" resolution.
 *
 * Renders the content, scans it for references to shared modules,
 * and prepends a "read first" instruction listing the source files
 * Claude should read before proceeding.
 */
export function buildSkillWithImports(
  content: string,
  extractedFiles: string[],
): string {
  const readFirst = resolveReadFirst(extractedFiles, content);
  const header = formatReadFirst(readFirst);
  return header ? header + "\n" + content : content;
}
