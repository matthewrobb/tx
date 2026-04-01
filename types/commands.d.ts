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
  objective?: string;
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
