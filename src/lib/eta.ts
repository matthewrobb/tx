/**
 * Eta template engine configuration with build-md helpers.
 */

import { Eta } from "eta";
import { resolve } from "path";

export function createEta(viewsDir: string): Eta {
  return new Eta({
    views: resolve(viewsDir),
    autoEscape: false,
    // Make build-md's md tagged template and MarkdownDocument available in all templates
    functionHeader: `
      const { md, MarkdownDocument } = require('build-md');
    `,
  });
}
