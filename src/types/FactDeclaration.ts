import { orderedFactSections } from "./Facts.js";

/** What a caller says it cares about. */
/** A section with nothing to name in it. Asking for it is the whole of what a caller can say. */
/** A section a reading is asked for, and whatever the asking said. */
export type Asked = Record<string, unknown>;

export type FactDeclaration = {
  /** The sections that answer with one value each: asking for them is all there is to say. */
  os?: Asked;
  arch?: Asked;
  cpu?: Asked;
  memory?: Asked;
  storage?: Asked;
  network?: Asked;
  virtualization?: Asked;
  privileges?: Asked;
  processes?: Record<string, ProcessDeclaration>;
  services?: Record<string, ServiceDeclaration>;
  tools?: Record<string, ToolDeclaration>;
  /** Named like tools, because a runtime is a tool seen from the other side. */
  runtimes?: Record<string, ToolDeclaration>;
  paths?: Record<string, PathDeclaration>;
  env?: Record<string, EnvDeclaration>;
  commands?: Record<string, CommandDeclaration>;
  artifacts?: Record<string, ArtifactDeclaration>;
  packages?: Record<string, PackageDeclaration>;
  users?: Record<string, UserDeclaration>;
  groups?: Record<string, GroupDeclaration>;
};

export type ProcessDeclaration = {
  /** Matched against the executable name; `sshd` finds `/usr/sbin/sshd`. */
  name?: string;
  command?: string;
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type ServiceDeclaration = {
  name?: string;
  manager?: string;
  platforms?: readonly string[];
};

export type ToolDeclaration = {
  name?: string;
  platforms?: readonly string[];
};

export type PathDeclaration = {
  /** Where to look, when the name is not the answer. */
  path?: string;
  /** Conditions that make the path acceptable; a path that fails them is an error, not an absence. */
  require?: readonly PathRequirement[];
  platforms?: readonly string[];
};

export type PathRequirement =
  | "exists"
  | "absent"
  | "file"
  | "directory"
  | "readable"
  | "writable"
  | "executable";

export type EnvDeclaration = {
  /** Alternative spellings of one variable: `HOME` on Unix, `USERPROFILE` on Windows. */
  names?: readonly string[];
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type CommandDeclaration = {
  /** The program to run, when it is not what the declaration calls it. */
  name?: string;
  args?: readonly string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type ArtifactDeclaration = {
  /** Where the artifact is, when the name is not already the path. */
  path?: string;
  kind?: string;
  /** How much of the artifact to keep: its shape, a digest of it, or the thing itself. */
  capture?: "metadata" | "hash" | "content";
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type UserDeclaration = {
  name?: string;
  /** Asserted rather than looked up: a user found under another id is an error, not a different user. */
  uid?: number | string;
  platforms?: readonly string[];
};

export type GroupDeclaration = {
  name?: string;
  gid?: number | string;
  platforms?: readonly string[];
};

export type PackageDeclaration = {
  /** What the package is called in each manager, when that differs from the name declared. */
  names?: readonly string[];
  manager?: string;
  platforms?: readonly string[];
};

/** What to do with output that may carry a secret. */
export type FactRedaction = {
  strategy: "none" | "omit" | "hash" | "mask";
  patterns?: readonly string[];
};

/** Every section there is to ask for, which is what `openstrap facts collect` means. */
export const everySection: FactDeclaration = Object.fromEntries(
  orderedFactSections.map((section) => [section, {}]),
) as FactDeclaration;
