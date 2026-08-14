/**
 * What openstrap and openstrap-server say to each other.
 *
 * Spelled here rather than imported, and spelled the same way on the other side, because the two are
 * separate products with separate release cycles. `openstrap-server/src/types/Api.ts` is the same
 * file from the other end; when this vocabulary is published as a package of its own, both plug into
 * it and this one goes.
 */

/** A machine as a blueprint declares it. The server stores it as the desired state, unread. */
export type DeclaredTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  transport: string;
  provider?: string;
  image?: string;
  size?: string;
  requirements: unknown[];
};

/** Which machine openstrap is running on. A port is only occupied on the host that forwards it. */
export type Host = {
  id: string;
  platform: string;
  architecture: string;
};

/** An image as the caller's provider resolved the name to, before anything was pinned. */
export type ResolvedImage = {
  reference: string;
  url: string;
  sha256: string;
  format: string;
  boot: string;
  platform: string;
  architecture: string;
};

export type OpenRunRequest = {
  command: "create" | "run";
  host: Host;
  target: DeclaredTarget;
  /** What `image: ubuntu:24.04` resolves to for this caller's provider, resolved beside the hypervisor. */
  proposedImage?: ResolvedImage;
  /** Deliberately replace the pin with what the name resolves to now. */
  repin?: boolean;
};

/** Everything openstrap needs that its blueprint does not say, decided in one transaction. */
export type OpenRunResponse = {
  runId: string;
  image: ResolvedImage;
  resources: {
    cpuCores: number;
    memoryBytes: number;
    diskBytes: number;
  };
  user: string;
  hostPort: number;
  identity: {
    publicKey: string;
    privateKey: string;
  };
  /** Present when the machine has been created before: openstrap adopts it rather than making it twice. */
  existing?: {
    provider: string;
    resourceId: string;
  };
};

/** Sent the moment a provider hands back an id, so a machine can never exist unrecorded. */
export type RecordResourceRequest = {
  provider: string;
  resourceId: string;
};

export type FinishRunRequest = {
  status: "succeeded" | "failed";
  /** The file this run actually built with, where the caller knows better than the server does. */
  image?: { reference: string; url: string; sha256: string };
  endpoint?: { host: string; port: number; user: string };
  steps: Array<{
    name: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    detail?: string;
  }>;
  snapshot?: {
    id: string;
    schemaVersion: string;
    capturedAt: string;
    facts: unknown;
  };
  requirementRun?: {
    id: string;
    status: string;
    evaluatedAt: string;
    results: unknown;
  };
};

/** One machine an organization has, as the server knows it. Whether it runs is asked of a provider. */
export type TargetSummary = {
  name: string;
  scope: string;
  type: string;
  transport: string;
  provider?: string;
  resourceId?: string;
  image?: { reference: string; sha256: string };
  /** Which machine last ran against it, so a laptop's vm is not shown as though it were shared. */
  host?: string;
  lastRunAt?: string;
};

/** What is needed to reach a machine that already exists: `connect`, and reading its facts. */
export type TargetAccessResponse = {
  provider: string;
  resourceId: string;
  transport: string;
  scope: string;
  type: string;
  /** What a machine made from the pinned image is; absent where nothing was ever pinned for it. */
  machine?: { platform: string; architecture: string };
  identity: { privateKey: string };
};
