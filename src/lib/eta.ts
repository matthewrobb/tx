/**
 * Eta template engine + skill rendering.
 *
 * Templates have direct access to (no `it.` prefix needed):
 * - extract(filePath, name) — extract a declaration, wrapped in ts code fence
 * - signature(filePath, name) — extract just the signature
 * - region(filePath, name) — extract a labeled region
 * - table(headers, rows) — build-md table
 * - defaults — full TwistedConfig defaults
 */

import { Eta } from "eta";
import { readFileSync } from "fs";
import { resolve } from "path";
import { embedDeclaration, embedSignature, embedRegion } from "./extract.js";
import { table } from "./markdown.js";
import { defaults } from "../config/defaults.js";
import { resolveReadFirst, formatReadFirst } from "./imports.js";

function createEta(viewsDir: string): Eta {
  return new Eta({
    views: resolve(viewsDir),
    autoEscape: false,
    // Destructure it.* into local variables so templates use extract() not it.extract()
    functionHeader: "const { extract, signature, region, table, defaults } = it;",
  });
}

function templateData(): Record<string, unknown> {
  return { extract: embedDeclaration, signature: embedSignature, region: embedRegion, table, defaults };
}

/**
 * Render a skill from an .eta template file.
 * Resolves "read first" references automatically.
 */
export function renderSkill(
  dir: string,
  filename: string,
  extractedFiles: string[],
): string {
  const eta = createEta(dir);
  const template = readFileSync(resolve(dir, filename), "utf-8");
  const content = eta.renderString(template, templateData());
  const readFirst = resolveReadFirst(extractedFiles, content);
  const header = formatReadFirst(readFirst);
  return header ? header + "\n" + content : content;
}
