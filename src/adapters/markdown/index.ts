// src/adapters/markdown/index.ts — barrel for the markdown projection adapter.

export { MarkdownProjectionAdapter } from './adapter.js';
export { renderIssue, renderCycle, renderSnapshot } from './renderer.js';
export type { Note, Task } from './renderer.js';
