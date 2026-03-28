/**
 * Template configuration — issue template fields and changelog format.
 *
 * The issue template is fully configurable. Users can add, remove,
 * or modify fields. Default fields cover the common case.
 */

/** Supported field types in the issue template. */
export type IssueFieldType =
  | "string"
  | "number"
  | "checkbox"
  | "enum"
  | "list";

/** A single field in the issue template. */
export interface IssueField {
  /** Field identifier used in the markdown template. */
  name: string;

  /** Display format for the field value. Uses `{id}` style placeholders. */
  format?: string;

  /** Data type. Determines rendering and validation. */
  type?: IssueFieldType;

  /** Allowed values when `type` is "enum". */
  values?: string[];

  /** Whether this field is required. Default: true. */
  required?: boolean;
}

/** Issue template definition. */
export interface IssueTemplate {
  /** Ordered list of fields in each issue. */
  fields: IssueField[];
}

/** Default issue field names shipped with twisted-workflow. */
export type DefaultIssueFieldName =
  | "id"
  | "title"
  | "type"
  | "area"
  | "file"
  | "current_state"
  | "target_state"
  | "dependencies"
  | "group"
  | "complexity"
  | "done";

/** Changelog entry template as an array of format strings. */
export type ChangelogTemplate = string[];

/** Templates configuration section. */
export interface TemplatesConfig {
  /** Issue template used during the decompose step. */
  issue: IssueTemplate;

  /** Changelog entry format used during the ship step. */
  changelog_entry: ChangelogTemplate;
}
