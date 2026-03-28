/**
 * Markdown helper functions for use in build scripts.
 * These are NOT the Eta template helpers (those go through functionHeader).
 * These are for programmatic markdown generation in TypeScript.
 */

export const section = (level: number, title: string, body: string): string =>
  `${"#".repeat(level)} ${title}\n\n${body}`;

export const table = (headers: string[], rows: string[][]): string => {
  const sep = headers.map(() => "---");
  const lines = [headers, sep, ...rows].map((r) => `| ${r.join(" | ")} |`);
  return lines.join("\n");
};

export const codeblock = (lang: string, code: string): string =>
  `\`\`\`${lang}\n${code}\n\`\`\``;

export const yaml = (code: string): string => codeblock("yaml", code);
export const json = (obj: unknown): string =>
  codeblock("json", JSON.stringify(obj, null, 2));
export const ts = (code: string): string => codeblock("typescript", code);

export const list = (items: string[], ordered = false): string =>
  items.map((item, i) => `${ordered ? `${i + 1}.` : "-"} ${item}`).join("\n");

export const bold = (text: string): string => `**${text}**`;
export const code = (text: string): string => `\`${text}\``;
export const link = (text: string, href: string): string => `[${text}](${href})`;
