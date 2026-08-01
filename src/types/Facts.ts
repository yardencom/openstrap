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
/**
 * Everything a machine can be asked about.
 *
 * Every section is optional, because a section nobody asked about is not collected and a snapshot
 * says what was read rather than what could have been. A reader that needs one says so in what it
 * declares, and a requirement written about a section it did not declare finds it missing — which is
 * the truth, and better than a fact nobody asked for.
 */
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

/**
 * Every section a machine is read into, and whether its entries are named.
 *
 * The one list. It was three: what "collect everything" means, which sections take names when a
 * requirement asks about them, and which keys a blueprint is allowed to write. Three hand-written
 * copies of the same twenty words, in three files, kept in step by whoever remembered — and they had
 * already drifted: `commands` and `artifacts` were readable facts that a blueprint could not ask
 * about, while `providers` and `caches` were allowed in a blueprint and are not facts at all.
 *
 * `entries` says how a section is asked for: `single` answers with one value, so asking is all there
 * is to say, and `named` needs the names of the things to look for, because no machine can list
 * every process or every path that might matter.
 *
 * `ordered` says whether it can be asked for at all. `transports` cannot: nothing on a machine can
 * answer which channel someone reached it through, so it is reported by whoever opened the channel
 * and no reading can be told to go and find it. A requirement may still be written about it.
 */
/**
 * What kind of thing a fact holds, and therefore what may be asked of it.
 *
 * A shape is a leaf, an object of shapes, or a map of them keyed by name. That is the whole grammar,
 * and it is enough to describe every section a machine is read into — which is the point: the schema a
 * blueprint is checked against is built from this, so what may be required is what is reported, and
 * neither can be edited without the other following.
 */
export type FactFieldKind = "status" | "string" | "number" | "boolean" | "strings" | "numbers";

export type FactShape =
  | FactFieldKind
  | { readonly fields: Readonly<Record<string, FactShape>>; readonly open?: boolean }
  | { readonly named: FactShape };

/** Everything a reading reports about a thing it found, plus whatever else that thing has. */
function observed(fields: Readonly<Record<string, FactShape>> = {}): FactShape {
  return { fields: { status: "status", reason: "string", message: "string", ...fields } };
}

/** A map keyed by the name of the thing: a service, a path, a port. */
function named(shape: FactShape): FactShape {
  return { named: shape };
}

/** How much of a machine a person is shown of it: `{ pretty: "Ubuntu 24.04.4 LTS" }`. */
const display: FactShape = { fields: {}, open: true };

/**
 * Every section a machine is read into: what it holds, and whether it can be asked for.
 *
 * The one description. It was three lists of section names kept in step by whoever remembered, and
 * then — after those were joined — one list of names here and the fields of every section written out
 * a second time by hand in the requirement schema. That second copy is what drifted: `pid` and `pids`
 * are on every service reading and no blueprint could require them.
 *
 * `ordered` says whether a reading can be told to go and find it. `transports` cannot: nothing on a
 * machine can answer which channel someone reached it through, so it is reported by whoever opened
 * the channel. A requirement may still be written about it.
 *
 * Whether a section takes names is not written down here either — a shape that is a map takes them,
 * and one that is not does not.
 */
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
        disks: named(observed()),
        filesystems: named(observed({
          mount: "string", device: "string", type: "string",
          totalBytes: "number", availableBytes: "number", usedBytes: "number",
          readOnly: "boolean",
        })),
        mounts: named(observed({
          path: "string", totalBytes: "number", availableBytes: "number",
        })),
      },
    },
  },
  network: {
    ordered: true,
    shape: {
      fields: {
        interfaces: named(observed({
          name: "string", type: "string", mac: "string", state: "string", mtu: "number",
        })),
        dns: { fields: { resolvers: "strings", search: "strings", domain: "string" } },
        // Reported in full by every reading, and until this description existed there was no way to
        // require one: the hand-written schema knew `network.firewall` and nothing else.
        ports: named(observed({
          protocol: "string", port: "number", state: "string",
          bind: "string", process: "string", service: "string",
        })),
        firewall: observed(),
        reachability: named(observed()),
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
        sudo: observed({ passwordless: "boolean" }),
        become: observed({ passwordless: "boolean" }),
        admin: observed({ passwordless: "boolean" }),
      },
    },
  },
  packages: {
    ordered: true,
    shape: {
      fields: {
        managers: named(observed()),
        installed: named(observed({ name: "string", manager: "string", version: "string" })),
      },
    },
  },
  users: {
    ordered: true,
    shape: named(observed({
      name: "string", uid: "number", gid: "number", home: "string",
      shell: "string", groups: "strings", gecos: "string",
    })),
  },
  groups: {
    ordered: true,
    shape: named(observed({ name: "string", gid: "number", members: "strings" })),
  },
  processes: {
    ordered: true,
    shape: named(observed({
      pid: "number", pids: "numbers", ppid: "number", name: "string", user: "string",
      command: "string", args: "string", state: "string",
      startedAt: "string", uptimeSeconds: "number",
    })),
  },
  services: {
    ordered: true,
    shape: named(observed({
      manager: "string", name: "string", state: "string", version: "string",
      enabled: "boolean", running: "boolean", pid: "number", pids: "numbers",
    })),
  },
  transports: {
    ordered: false,
    shape: named(observed({
      type: "string", endpoint: "string", authMethods: "strings",
      ready: "boolean", version: "string",
    })),
  },
  runtimes: {
    ordered: true,
    shape: named(observed({
      type: "string", version: "string", ready: "boolean",
      endpoint: "string", capabilities: "strings",
    })),
  },
  paths: {
    ordered: true,
    shape: named(observed({
      path: "string", type: "string", exists: "boolean", owner: "string", group: "string",
      mode: "string", readable: "boolean", writable: "boolean", executable: "boolean",
      sizeBytes: "number",
    })),
  },
  tools: {
    ordered: true,
    shape: named(observed({
      name: "string", path: "string", version: "string",
      executable: "boolean", capabilities: "strings",
    })),
  },
  env: {
    ordered: true,
    shape: named(observed({
      name: "string", value: "string", redacted: "boolean", sensitive: "boolean",
    })),
  },
  commands: {
    ordered: true,
    shape: named(observed({
      name: "string", args: "strings", stdout: "string", stderr: "string", exitCode: "number",
    })),
  },
  artifacts: {
    ordered: true,
    shape: named(observed({
      path: "string", kind: "string", type: "string",
      sizeBytes: "number", sha256: "string", content: "string",
    })),
  },
} satisfies Record<keyof FactSections, { ordered: boolean; shape: FactShape }>;

export type FactSection = keyof typeof factSections;

/** What a section holds, for anything that needs to know what may be said about it. */
export function shapeOf(section: FactSection): FactShape {
  return factSections[section].shape;
}

/** Sections a reading can be told to go and find. */
export const orderedFactSections: readonly FactSection[] = Object.entries(factSections)
  .filter(([, section]) => section.ordered)
  .map(([name]) => name as FactSection);

/**
 * Sections whose entries a caller has to name for a reading to find them.
 *
 * Read off the shape rather than declared beside it: a section that is a map of named things needs
 * names, and one that is not does not. Two ways of saying it would be two things to keep in step.
 */
export const namedFactSections: readonly FactSection[] = Object.entries(factSections)
  .filter(([, section]) => typeof section.shape === "object" && "named" in section.shape)
  .map(([name]) => name as FactSection);

/**
 * Nothing missing from the list above.
 *
 * `satisfies` catches a name that is not a section; this catches a section that is not in the list,
 * which is the direction that actually went wrong. Adding a section to the model and forgetting it
 * here stops the build rather than quietly producing a blueprint key nobody accepts.
 */
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
