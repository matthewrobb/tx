export type TwistedSubcommand =
  | "init"
  | "open"
  | "close"
  | "status"
  | "next"
  | "resume"
  | "research"
  | "scope"
  | "plan"
  | "build"
  | "ready"
  | "archive"
  | "estimate"
  | "promote"
  | "backlog"
  | "stories"
  | "pickup"
  | "handoff"
  | "session"
  | "write"
  | "read"
  | "artifacts"
  | "tasks"
  | "note"
  | "notes"
  | "config";

export interface GlobalFlags {
  yolo: boolean;
  agent: boolean;
  /** Target epic by name (-e / --epic). */
  epic?: string;
}

export interface OpenParams {
  epic: string;
  type?: import("./epic").EpicType;
}

export interface ArchiveParams {
  epic?: string;
  reason?: string;
}

export interface WriteParams {
  type: ArtifactType;
  epic?: string;
  number?: number;
}

export interface ReadParams {
  type: ArtifactType;
  epic?: string;
}

export type ArtifactType = "research" | "scope" | "plan" | "changelog";

export interface NoteParams {
  summary: string;
  type?: import("./notes").NoteType;
  reason?: string;
  impact?: string;
}

export interface TasksParams {
  action?: "add" | "update" | "show";
  id?: string;
  summary?: string;
  done?: boolean;
  group?: string | null;
}

export interface SessionParams {
  action: "status" | "save" | "list";
  name?: string;
}

export interface ParsedCommand {
  subcommand: TwistedSubcommand | undefined;
  params: Record<string, unknown>;
  flags: GlobalFlags & { version?: boolean; help?: boolean };
  raw_args: string;
}
