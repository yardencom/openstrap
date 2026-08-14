import type { TransportEndpoint } from "./Transport.js";

export type TargetScope = "host" | "guest" | "network";

export type TargetType = "vm" | "container" | "host";

export type ProviderCapabilities = {
  scopes: readonly TargetScope[];
  types: readonly TargetType[];
  resize: boolean;
  portForward: boolean;
};

/**
 * Whether the external tool this provider drives is usable on this host.
 *
 * A missing hypervisor is never installed silently: the provider reports the
 * command that would install it and the caller asks the user first.
 */
export type ProviderAvailability = {
  available: boolean;
  version?: string;
  reason?: string;
  install?: {
    description: string;
    command: string;
  };
};

/**
 * The file a machine is made from, and the checksum it was published with.
 *
 * openstrap resolves the name and hands the provider the answer: which bytes to boot is one
 * decision, made once and written down as the target's pin, and a provider that resolved names of
 * its own would be a second catalogue that can disagree with it.
 */
export type ResolvedImage = {
  reference: string;
  url: string;
  /**
   * The checksum the file was published with, where its publisher published one.
   *
   * Not everyone does. A publisher who serves an image and no digest for it is trusted for the
   * bytes over the same TLS either way; what is lost is the pin holding a later fetch to the same
   * file, and a URL that names a version is what holds it then. Present means it is checked, and a
   * file that does not match is deleted rather than booted.
   */
  sha256?: string;
  /**
   * What a machine made from this image will be.
   *
   * The platform is what the image installs, the architecture is what it was built for. openstrap
   * records both when it creates the machine, because that is the moment they are known — and
   * later, when it has to deliver itself there, the alternative is working out from the machine
   * what it already decided.
   */
  platform: string;
  architecture: string;
  format: string;
  boot: string;
};

export type MachineResources = {
  cpuCores: number;
  memoryBytes: number;
  diskBytes: number;
};

export type MachineRequest = {
  name: string;
  image: ResolvedImage;
  resources: MachineResources;
  /** The managed user the guest is bootstrapped with. */
  user: string;
  /** Public half only. How a guest is handed this key is the provider's business. */
  publicKey: string;
  hostPort: number;
  guestPort: number;
};

/**
 * Identifies a machine inside the provider. openstrap stores this mapping but
 * not the machine's actual state — that is read back from the provider.
 */
export type MachineHandle = {
  id: string;
  name: string;
};

export type MachineStatus = "running" | "stopped" | "suspended" | "unknown";

export type MachineState = {
  status: MachineStatus;
  resources?: MachineResources;
};

export type MachineAccess = {
  transport: string;
  endpoint: TransportEndpoint;
};

/**
 * Creates and drives the lifecycle of a machine through an external tool.
 *
 * Every method is asynchronous: plugins run in-process today and out of
 * process later, and a synchronous contract would close that door for good.
 */
export type Provider = {
  id: string;
  displayName?: string;
  capabilities: ProviderCapabilities;

  detect(): Promise<ProviderAvailability>;

  create(request: MachineRequest): Promise<MachineHandle>;
  start(machine: MachineHandle): Promise<void>;
  stop(machine: MachineHandle): Promise<void>;
  restart(machine: MachineHandle): Promise<void>;
  delete(machine: MachineHandle): Promise<void>;

  inspect(machine: MachineHandle): Promise<MachineState>;
  access(machine: MachineHandle): Promise<MachineAccess>;
  find(name: string): Promise<MachineHandle | null>;
};
