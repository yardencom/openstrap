export type ObservedStatus = "present" | "absent" | "unknown" | "unsupported" | "error";

export type Observed = {
  status: ObservedStatus;
  reason?: string;
  message?: string;
};

export type FactScope = "host" | "guest" | "network";

export type FactTarget = {
  type: string;
  id: string;
  displayName?: string;
};

export type FactCollectionTarget = {
  name: string;
  scope: FactScope;
  type: string;
  displayName?: string;
  transport: "local";
};

export type FactSnapshot<TData = NormalizedFactData> = {
  id: string;
  schemaVersion: string;
  scope: FactScope;
  target: FactTarget;
  data: TData;
};

export type FactRunStatus = "success" | "warning" | "error";

export type FactRun = {
  id: string;
  snapshotId: string;
  startedAt: string;
  finishedAt: string;
  status: FactRunStatus;
  validUntil?: string;
  ttl?: string;
  attempt?: number;
};

export type FactCollectionItem = {
  snapshot: FactSnapshot;
  run: FactRun;
};

export type FactCollection = readonly FactCollectionItem[];

export type NormalizedFactData = HostSystem | GuestSystem | Network;

export type Display = Record<string, string>;

export type BaseSystem = {
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
  users: {
    current?: Record<string, unknown>;
    managed?: Record<string, unknown>;
    entries?: Record<string, unknown>;
  };
  packages: {
    managers: Record<string, Observed & Record<string, unknown>>;
    installed?: Record<string, unknown>;
  };
  processes: Record<string, Process>;
  services: Record<string, Service>;
  transports: Record<string, Transport>;
  privileges: {
    mode?: string;
    sudo?: Observed & Record<string, unknown>;
    become?: Observed & Record<string, unknown>;
    admin?: Observed & Record<string, unknown>;
  };
  runtimes: Record<string, RuntimeFact>;
  paths?: Record<string, PathFact>;
  tools?: Record<string, ToolFact>;
  env?: Record<string, EnvVarFact>;
};

export type HostSystem = BaseSystem & {
  providers: Record<string, Observed & Record<string, unknown>>;
  caches: {
    images?: Record<string, unknown>;
    downloads?: Record<string, unknown>;
    packages?: Record<string, unknown>;
  };
};

export type GuestSystem = BaseSystem;

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

export type Transport = Observed & {
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

export type Process = Observed & {
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

export type Service = Observed & {
  manager?: string;
  name?: string;
  enabled?: boolean;
  running?: boolean;
  state?: string;
  pid?: number;
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
