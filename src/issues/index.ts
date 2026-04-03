// src/issues/index.ts — barrel export for the issues module.

export {
  createIssue,
  getIssue,
  getIssueBySlug,
  listIssues,
  updateIssue,
  closeIssue,
  archiveIssue,
} from './crud.js';

export type {
  CreateIssueInput,
  ListIssuesOptions,
  IssueUpdate,
} from './crud.js';

export {
  getChildren,
  shouldAutoClose,
  propagateDone,
} from './hierarchy.js';
