/**
 * What a caller says it cares about.
 *
 * Nothing here describes how to find anything — it names things: the process
 * called `node`, the path called `workspace`, the service called `sshd`. Naming
 * is the caller's half of the contract, because a reading that answered by
 * identity alone ("pid 4711") could never answer the question anybody asked.
 *
 * Every name that is declared comes back answered, present or absent. A
 * declared name that produced no entry would be indistinguishable from a name
 * nobody asked about.
 */
export type FactDeclaration = {
  /**
   * Which sections to read at all.
   *
   * Reading a machine costs time, so a caller that only compares memory should
   * not pay for its process table. Omitting this reads everything that can be
   * read without being asked to name something.
   */
  sections?: readonly string[];
  processes?: Record<string, ProcessDeclaration>;
  services?: Record<string, ServiceDeclaration>;
  tools?: Record<string, ToolDeclaration>;
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
  path: string;
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
  names: readonly string[];
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type CommandDeclaration = {
  name: string;
  args?: readonly string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  platforms?: readonly string[];
  redaction?: FactRedaction;
};

export type ArtifactDeclaration = {
  path: string;
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
  names: readonly string[];
  manager?: string;
  platforms?: readonly string[];
};

/**
 * What to do with output that may carry a secret.
 *
 * Spelled here rather than reused from the definition file format: redaction has
 * to be applied where the output is read, and that happens on the target, which
 * knows nothing about YAML.
 */
export type FactRedaction = {
  strategy: "none" | "omit" | "hash" | "mask";
  patterns?: readonly string[];
};
