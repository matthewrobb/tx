/**
 * Source code extraction — pull named declarations from .ts files
 * for embedding in generated SKILL.md files.
 *
 * Uses the TypeScript compiler API to parse AST and extract exact source text.
 */

import ts from "typescript";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "../..");
const cache = new Map<string, ts.SourceFile>();

function getSourceFile(filePath: string): ts.SourceFile {
  const absPath = resolve(ROOT, filePath);
  if (!cache.has(absPath)) {
    const code = readFileSync(absPath, "utf-8");
    cache.set(absPath, ts.createSourceFile(absPath, code, ts.ScriptTarget.Latest, true));
  }
  return cache.get(absPath)!;
}

/**
 * Get the full text of a node including leading JSDoc/comments.
 */
function getNodeWithComments(node: ts.Node, source: ts.SourceFile): string {
  const sourceText = source.getFullText();
  const nodeStart = node.getStart(source);
  const nodeEnd = node.getEnd();

  // Look for leading comments (JSDoc, // comments)
  const commentRanges = ts.getLeadingCommentRanges(sourceText, node.getFullStart());
  const commentStart = commentRanges?.[0]?.pos ?? nodeStart;

  return sourceText.slice(commentStart, nodeEnd).trim();
}

/**
 * Extract a named top-level declaration (function, interface, type, const) from a .ts file.
 * Returns the full source text of the declaration INCLUDING leading JSDoc/comments.
 */
export function extractDeclaration(filePath: string, name: string): string {
  const source = getSourceFile(filePath);
  let result: string | null = null;

  ts.forEachChild(source, (node) => {
    if (result) return;

    // function declarations: function foo() {}
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      result = getNodeWithComments(node, source);
      return;
    }

    // interface declarations: interface Foo {}
    if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
      result = getNodeWithComments(node, source);
      return;
    }

    // type alias declarations: type Foo = ...
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
      result = getNodeWithComments(node, source);
      return;
    }

    // const/let/var declarations: export const foo = ...
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) {
          result = getNodeWithComments(node, source);
          return;
        }
      }
    }

    // enum declarations: enum Foo {}
    if (ts.isEnumDeclaration(node) && node.name.text === name) {
      result = getNodeWithComments(node, source);
      return;
    }
  });

  if (!result) {
    throw new Error(`Declaration "${name}" not found in ${filePath}`);
  }

  return result;
}

/**
 * Extract just the signature of a function (no body).
 * Returns the function declaration up to and including the return type,
 * replacing the body with a comment.
 */
export function extractSignature(filePath: string, name: string): string {
  const source = getSourceFile(filePath);
  let result: string | null = null;

  ts.forEachChild(source, (node) => {
    if (result) return;

    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) {
      const fullText = getNodeWithComments(node, source);
      const bodyText = node.body.getText(source);
      result = fullText.replace(bodyText, "{ /* ... */ }");
      return;
    }
  });

  if (!result) {
    throw new Error(`Function "${name}" not found in ${filePath}`);
  }

  return result;
}

/**
 * Extract a labeled region from a .ts file.
 * Regions are marked with comments:
 *   // #region name
 *   ... code ...
 *   // #endregion name
 */
export function extractRegion(filePath: string, regionName: string): string {
  const absPath = resolve(ROOT, filePath);
  const code = readFileSync(absPath, "utf-8");
  const startMarker = `// #region ${regionName}`;
  const endMarker = `// #endregion ${regionName}`;

  const startIdx = code.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`Region "${regionName}" not found in ${filePath}`);
  }

  const contentStart = code.indexOf("\n", startIdx) + 1;
  const endIdx = code.indexOf(endMarker, contentStart);
  if (endIdx === -1) {
    throw new Error(`Region "${regionName}" end marker not found in ${filePath}`);
  }

  return code.slice(contentStart, endIdx).trim();
}

/**
 * Wrap extracted code in a markdown TypeScript code fence.
 */
export function tsBlock(code: string): string {
  return "```ts\n" + code + "\n```";
}

/**
 * Extract a declaration and wrap it in a code fence.
 */
export function embedDeclaration(filePath: string, name: string): string {
  return tsBlock(extractDeclaration(filePath, name));
}

/**
 * Extract a function signature and wrap it in a code fence.
 */
export function embedSignature(filePath: string, name: string): string {
  return tsBlock(extractSignature(filePath, name));
}

/**
 * Extract a region and wrap it in a code fence.
 */
export function embedRegion(filePath: string, regionName: string): string {
  return tsBlock(extractRegion(filePath, regionName));
}
