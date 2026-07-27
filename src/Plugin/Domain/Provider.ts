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

export type ImageRequest = {
  name: string;
  architecture: string;
};

export type ResolvedImage = {
  reference: string;
  url: string;
  sha256: string;
  signatureUrl?: string;
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
  /** Cloud-init seed built by the provider; never carries a private key. */
  seedPath: string;
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
  resolveImage(request: ImageRequest): Promise<ResolvedImage>;

  create(request: MachineRequest): Promise<MachineHandle>;
  start(machine: MachineHandle): Promise<void>;
  stop(machine: MachineHandle): Promise<void>;
  restart(machine: MachineHandle): Promise<void>;
  delete(machine: MachineHandle): Promise<void>;

  inspect(machine: MachineHandle): Promise<MachineState>;
  access(machine: MachineHandle): Promise<MachineAccess>;
  find(name: string): Promise<MachineHandle | null>;
};
