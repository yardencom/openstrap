/**
 * What openstrap can observe about a machine, and how it says so.
 *
 * Every named thing carries a status rather than being present or missing from
 * the snapshot: a caller asked about `sshd`, so "we looked and it is not there"
 * and "nobody looked" are different answers and have to read differently.
 */
export type ObservedStatus = "present" | "absent" | "unknown" | "unsupported" | "error";

export type Observed = {
  status: ObservedStatus;
  reason?: string;
  message?: string;
};

export type Display = Record<string, string>;

/**
 * One machine, section by section.
 *
 * The sections a requirement compares against a single value — memory, cpu,
 * architecture — are plain. The sections a requirement asks about by name are
 * maps keyed by that name, never lists: "is `sshd` running" is a question only
 * a map can answer.
 */
export type FactData = {
  os: {
    family: string;
    name: string;
    version: string;
    codename?: string;
    kernel?: string;
    edition?: string;
    display?: Display;
  };
  arch: string;
  cpu: {
    cores: number;
    threads?: number;
    model?: string;
    vendor?: string;
    features?: string[];
    load?: number[];
    display?: Display;
  };
  memory: {
    totalBytes: number;
    availableBytes?: number;
    swapTotalBytes?: number;
    swapUsedBytes?: number;
    pressure?: string;
    display?: Display;
  };
  storage: {
    disks?: Record<string, unknown>;
    filesystems?: Record<string, unknown>;
    mounts: Record<string, unknown>;
    totalBytes?: number;
    availableBytes?: number;
    display?: Display;
  };
  virtualization?: {
    supported: boolean;
    enabled?: boolean;
    type?: string;
    nested?: boolean;
    reason?: string;
  };
  network: Network;
  /**
   * The users the caller named, plus the account the reading ran as.
   *
   * Keyed by name like every other section asked about by name, because that is
   * how the question is put: "is there a user `openstrap`". The reading account is
   * always in here under its own name, so a snapshot always says who read it —
   * two snapshots taken as different accounts are not comparable.
   */
  users: Record<string, UserFact>;
  groups: Record<string, GroupFact>;
  packages: {
    managers: Record<string, Observed & Record<string, unknown>>;
    installed?: Record<string, PackageFact>;
  };
  privileges: {
    mode?: string;
    sudo?: Observed & Record<string, unknown>;
    become?: Observed & Record<string, unknown>;
    admin?: Observed & Record<string, unknown>;
  };
  processes: Record<string, ProcessFact>;
  services: Record<string, ServiceFact>;
  transports: Record<string, TransportFact>;
  runtimes: Record<string, RuntimeFact>;
  paths: Record<string, PathFact>;
  tools: Record<string, ToolFact>;
  env: Record<string, EnvVarFact>;
  commands: Record<string, CommandFact>;
  artifacts: Record<string, ArtifactFact>;
};

export type Network = {
  interfaces: Record<string, NetworkInterface>;
  dns: {
    resolvers?: string[];
    search?: string[];
    domain?: string;
  };
  ports: Record<string, PortFact>;
  firewall: Observed & Record<string, unknown>;
  reachability: Record<string, Observed & Record<string, unknown>>;
};

export type NetworkInterface = {
  name: string;
  type?: string;
  mac?: string;
  state?: string;
  mtu?: number;
  addresses?: Array<{
    ip: string;
    family: string;
    prefix?: number;
    scope?: string;
  }>;
};

export type TransportFact = Observed & {
  type: string;
  endpoint?: string;
  authMethods?: string[];
  ready?: boolean;
  version?: string;
};

export type RuntimeFact = Observed & {
  type: string;
  version?: string;
  ready?: boolean;
  endpoint?: string;
  capabilities?: string[];
};

export type ProcessFact = Observed & {
  pid?: number;
  pids?: number[];
  ppid?: number;
  name?: string;
  user?: string;
  command?: string;
  args?: string;
  state?: string;
  startedAt?: string;
  uptimeSeconds?: number;
};

export type ServiceFact = Observed & {
  manager?: string;
  name?: string;
  enabled?: boolean;
  running?: boolean;
  state?: string;
  pid?: number;
  pids?: number[];
  version?: string;
};

export type UserFact = Observed & {
  name: string;
  uid?: number;
  gid?: number;
  home?: string;
  shell?: string;
  /** Every group the account belongs to, primary group included. */
  groups?: string[];
  gecos?: string;
};

export type GroupFact = Observed & {
  name: string;
  gid?: number;
  members?: string[];
};

export type PackageFact = Observed & {
  name: string;
  manager?: string;
  version?: string;
};

export type PortFact = Observed & {
  protocol: string;
  port: number;
  state?: string;
  bind?: string;
  process?: string;
  service?: string;
  forward?: {
    from?: string;
    to?: string;
  };
};

export type PathFact = Observed & {
  path: string;
  type?: string;
  exists?: boolean;
  owner?: string;
  group?: string;
  mode?: string;
  readable?: boolean;
  writable?: boolean;
  executable?: boolean;
  sizeBytes?: number;
};

export type ToolFact = Observed & {
  name: string;
  path?: string;
  version?: string;
  executable?: boolean;
  capabilities?: string[];
};

export type EnvVarFact = Observed & {
  name: string;
  value?: string;
  redacted?: boolean;
  sensitive?: boolean;
};

/**
 * What a command the caller declared actually printed.
 *
 * This is a fact section like any other rather than a separate kind of
 * "evidence": the caller asked what `sshd -T` says on this machine, and the
 * answer is as much a fact about the machine as its memory size.
 */
export type CommandFact = Observed & {
  name: string;
  args?: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
};

export type ArtifactFact = Observed & {
  path: string;
  kind?: string;
  type?: string;
  sizeBytes?: number;
  sha256?: string;
  content?: string;
};
