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
  runtimes?: Asked;
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

/**
 * Every section there is to ask for, which is what `openstrap facts collect` means.
 *
 * Written out here, in the file that declares what a caller may ask for, because that is the one
 * place where a new section is added — and a section added to the type and not to this would be a
 * section the command that collects everything quietly stops collecting. A test holds the two
 * together.
 *
 * `transports` is not here: nothing on a machine can answer it. It is what the caller that opened
 * the channel says, and it comes with the order rather than being asked for in it.
 */
export const everySection: FactDeclaration = {
  os: {}, arch: {}, cpu: {}, memory: {}, storage: {}, network: {}, virtualization: {}, privileges: {},
  runtimes: {}, processes: {}, services: {}, tools: {}, paths: {}, env: {}, commands: {},
  artifacts: {}, packages: {}, users: {}, groups: {},
};
