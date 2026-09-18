/** What openstrap can observe about a machine, and how it says so. */
export type ObservedStatus = "present" | "absent" | "unknown" | "unsupported" | "error";

export type Observed = {
  status: ObservedStatus;
  reason?: string;
  message?: string;
};

export type Display = Record<string, string>;

/** One machine, section by section. */
/** Everything a machine can be asked about. */
export type FactSections = {
  os?: {
    family: string;
    name: string;
    version: string;
    codename?: string;
    kernel?: string;
    edition?: string;
    display?: Display;
  };
  arch?: string;
  cpu?: {
    cores: number;
    threads?: number;
    model?: string;
    vendor?: string;
    features?: string[];
    load?: number[];
    display?: Display;
  };
  memory?: {
    totalBytes: number;
    availableBytes?: number;
    swapTotalBytes?: number;
    swapUsedBytes?: number;
    pressure?: string;
    display?: Display;
  };
  storage?: {
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
  network?: Network;
  /** The users the caller named, plus the account the reading ran as. */
  users: Record<string, UserFact>;
  groups: Record<string, GroupFact>;
  packages?: {
    managers: Record<string, Observed & Record<string, unknown>>;
    installed?: Record<string, PackageFact>;
  };
  privileges?: {
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

/** Every section a machine is read into, and whether its entries are named. */
/** What kind of thing a fact holds, and therefore what may be asked of it. */
export type FactFieldKind = "status" | "string" | "number" | "boolean" | "strings" | "numbers";

export type FactShape =
  | FactFieldKind
  | { readonly told: FactFieldKind }
  | { readonly fields: Readonly<Record<string, FactShape>>; readonly open?: boolean }
  | { readonly named: FactShape };

/** How much of a machine a person is shown of it: `{ pretty: "Ubuntu 24.04.4 LTS" }`. */
const display: FactShape = { fields: {}, open: true };

/** Every section a machine is read into: what it holds, and whether it can be asked for. */
/** The words the model is written in, and how a section's shape is looked up. */
export class Shape {
  /** Everything a reading reports about a thing it found, plus whatever else that thing has. */
  static observed(fields: Readonly<Record<string, FactShape>> = {}): FactShape {
    return { fields: { status: "status", reason: "string", message: "string", ...fields } };
  }

  /** A field the reading is told rather than asked. */
  static told(kind: FactFieldKind): FactShape {
    return { told: kind };
  }

  /** A map keyed by the name of the thing: a service, a path, a port. */
  static named(shape: FactShape): FactShape {
    return { named: shape };
  }

  /** What a section holds, for anything that needs to know what may be said about it. */
  static of(section: FactSection): FactShape {
    return factSections[section].shape;
  }
}

export const factSections = {
  os: {
    ordered: true,
    shape: {
      fields: {
        family: "string", name: "string", version: "string",
        codename: "string", kernel: "string", edition: "string", display,
      },
    },
  },
  // A section that is one value rather than an object: `arch: arm64`.
  arch: { ordered: true, shape: "string" },
  cpu: {
    ordered: true,
    shape: {
      fields: {
        cores: "number", threads: "number", model: "string", vendor: "string",
        features: "strings", load: "numbers", display,
      },
    },
  },
  memory: {
    ordered: true,
    shape: {
      fields: {
        totalBytes: "number", availableBytes: "number",
        swapTotalBytes: "number", swapUsedBytes: "number",
        pressure: "string", display,
      },
    },
  },
  storage: {
    ordered: true,
    shape: {
      fields: {
        totalBytes: "number", availableBytes: "number", display,
        disks: Shape.named(Shape.observed()),
        filesystems: Shape.named(Shape.observed({
          mount: "string", device: "string", type: "string",
          totalBytes: "number", availableBytes: "number", usedBytes: "number",
          readOnly: "boolean",
        })),
        mounts: Shape.named(Shape.observed({
          path: "string", totalBytes: "number", availableBytes: "number",
        })),
      },
    },
  },
  network: {
    ordered: true,
    shape: {
      fields: {
        interfaces: Shape.named(Shape.observed({
          name: "string", type: "string", mac: "string", state: "string", mtu: "number",
        })),
        dns: { fields: { resolvers: "strings", search: "strings", domain: "string" } },
        // Reported in full by every reading, and until this description existed there was no way to
        // require one: the hand-written schema knew `network.firewall` and nothing else.
        ports: Shape.named(Shape.observed({
          protocol: "string", port: "number", state: "string",
          bind: "string", process: "string", service: "string",
          // Whether knocking on it gets an answer, which is a different question from whether a
          // program on this machine has claimed it. A container publishes a port by a firewall rule
          // and claims nothing, so `state: listening` is false there while the port answers; a port
          // held by a program behind a closed firewall is the other way round.
          //
          // Read only for a port some requirement named. Knocking on every port a machine might have
          // is a port scan, and openstrap does not do that to the machine it was asked about.
          reachable: "boolean",
        })),
        firewall: Shape.observed(),
        reachability: Shape.named(Shape.observed()),
      },
    },
  },
  virtualization: {
    ordered: true,
    shape: {
      fields: {
        supported: "boolean", enabled: "boolean", type: "string",
        nested: "boolean", reason: "string",
      },
    },
  },
  privileges: {
    ordered: true,
    shape: {
      fields: {
        mode: "string",
        sudo: Shape.observed({ passwordless: "boolean" }),
        become: Shape.observed({ passwordless: "boolean" }),
        admin: Shape.observed({ passwordless: "boolean" }),
      },
    },
  },
  packages: {
    ordered: true,
    shape: {
      fields: {
        managers: Shape.named(Shape.observed()),
        installed: Shape.named(Shape.observed({ name: Shape.told("string"), manager: Shape.told("string"), version: "string" })),
      },
    },
  },
  users: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      name: Shape.told("string"), uid: Shape.told("number"), gid: "number", home: "string",
      shell: "string", groups: "strings", gecos: "string",
    })),
  },
  groups: {
    ordered: true,
    shape: Shape.named(Shape.observed({ name: Shape.told("string"), gid: Shape.told("number"), members: "strings" })),
  },
  processes: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      pid: "number", pids: "numbers", ppid: "number", name: Shape.told("string"), user: "string",
      command: Shape.told("string"), args: "string", state: "string",
      startedAt: "string", uptimeSeconds: "number",
    })),
  },
  services: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      manager: Shape.told("string"), name: Shape.told("string"), state: "string", version: "string",
      enabled: "boolean", running: "boolean", pid: "number", pids: "numbers",
    })),
  },
  transports: {
    ordered: false,
    shape: Shape.named(Shape.observed({
      type: "string", endpoint: "string", authMethods: "strings",
      ready: "boolean", version: "string",
    })),
  },
  runtimes: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      type: "string", version: "string", ready: "boolean",
      endpoint: "string", capabilities: "strings",
    })),
  },
  paths: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      path: Shape.told("string"), type: "string", exists: "boolean", owner: "string", group: "string",
      mode: "string", readable: "boolean", writable: "boolean", executable: "boolean",
      sizeBytes: "number",
    })),
  },
  tools: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      name: Shape.told("string"), path: "string", version: "string",
      executable: "boolean", capabilities: "strings",
    })),
  },
  env: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      name: Shape.told("string"), value: "string", redacted: "boolean", sensitive: "boolean",
    })),
  },
  commands: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      name: Shape.told("string"), args: Shape.told("strings"), stdout: "string", stderr: "string",
      exitCode: "number",
    })),
  },
  artifacts: {
    ordered: true,
    shape: Shape.named(Shape.observed({
      path: Shape.told("string"), kind: Shape.told("string"), type: "string",
      sizeBytes: "number", sha256: "string", content: "string",
    })),
  },
} satisfies Record<keyof FactSections, { ordered: boolean; shape: FactShape }>;

export type FactSection = keyof typeof factSections;

/** Sections a reading can be told to go and find. */
export const orderedFactSections: readonly FactSection[] = Object.entries(factSections)
  .filter(([, section]) => section.ordered)
  .map(([name]) => name as FactSection);

/** Sections whose entries a caller has to name for a reading to find them. */
export const namedFactSections: readonly FactSection[] = Object.entries(factSections)
  .filter(([, section]) => typeof section.shape === "object" && "named" in section.shape)
  .map(([name]) => name as FactSection);

/** Nothing missing from the list above. */
type EverySectionListed = [Exclude<keyof FactSections, FactSection>] extends [never] ? true : never;
export const everySectionListed: EverySectionListed = true;

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
  /** Whether a connection to it was accepted. Absent for a port nobody asked about. */
  reachable?: boolean;
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

/** What a command the caller declared actually printed. */
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
