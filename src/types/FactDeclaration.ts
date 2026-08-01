import { orderedFactSections } from "./Facts.js";

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
/** A section with nothing to name in it. Asking for it is the whole of what a caller can say. */
export type Asked = Record<string, never>;

export type FactDeclaration = {
  /**
   * The sections that answer with one value each: asking for them is all there is to say.
   *
   * Reading a machine costs time — the network alone costs more than everything else put together —
   * so a section that is not here is not read, and is absent from the facts rather than present and
   * unwanted.
   */
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
  /**
   * Where to look, when the name is not the answer.
   *
   * A declaration names a thing, and for a path the name usually is the path — `/etc/ssh/sshd_config`
   * is both. This is for the times it is not: `config` meaning something the caller knows the
   * location of. Left out, the collector takes the name.
   */
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
  /**
   * Alternative spellings of one variable: `HOME` on Unix, `USERPROFILE` on Windows.
   *
   * Left out, the variable is spelled the way it is named.
   */
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

/**
 * Every section there is to ask for, which is what `openstrap facts collect` means.
 *
 * Read from the one list of sections rather than typed out again. It used to be written out here,
 * and a section added to the model and not to this line was a section that `facts collect` quietly
 * stopped collecting.
 *
 * `transports` is left out: nothing on a machine can answer it. It is what the caller that opened
 * the channel says, and it comes with the order rather than being asked for in it.
 */
export const everySection: FactDeclaration = Object.fromEntries(
  orderedFactSections.map((section) => [section, {}]),
) as FactDeclaration;
