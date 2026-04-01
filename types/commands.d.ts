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
  /** v3: target objective by name. */
  objective?: string;
  /** v4: target epic by name (-e / --epic). */
  epic?: string;
}

/** v4: Open with an epic type. */
export interface OpenParamsV4 {
  epic: string;
  type?: import("./epic").EpicType;
}

/** v4: Archive an epic with a reason. */
export interface ArchiveParams {
  epic?: string;
  reason?: string;
}

export interface OpenParams {
  objective: string;
}

export interface CloseParams {
  objective?: string;
}

export interface WriteParams {
  type: ArtifactType;
  objective?: string;
  number?: number;
}

export interface ReadParams {
  type: ArtifactType;
  objective?: string;
}

export type ArtifactType = "research" | "scope" | "plan" | "changelog";

export interface NoteParams {
  summary: string;
  type?: import("./notes").NoteType;
  reason?: string;
  impact?: string;
}

export interface TasksParams {
  action?: "add" | "update" | "assign" | "show";
  id?: number;
  summary?: string;
  done?: boolean;
  group?: number;
}

export interface SessionParams {
  action: "status" | "save" | "list";
  name?: string;
}

export interface PickupParams {
  name?: string;
}

export interface HandoffParams {
  name?: string;
}

export interface ParsedCommand {
  subcommand: TwistedSubcommand | undefined;
  params: Record<string, unknown>;
  flags: GlobalFlags & { version?: boolean; help?: boolean };
  raw_args: string;
}
