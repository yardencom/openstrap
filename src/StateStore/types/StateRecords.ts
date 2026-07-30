export type TargetRecord = {
  name: string;
  scope: string;
  type: string;
  provider?: string;
  transport: string;
};

export type RunStatus = "running" | "succeeded" | "failed";

export type RunRecord = {
  id: string;
  target: string;
  command: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
};

export type RunStepRecord = {
  runId: string;
  ordinal: number;
  name: string;
  status: RunStatus | "skipped";
  startedAt: string;
  finishedAt?: string;
  detail?: string;
};

export type ProviderResourceRecord = {
  target: string;
  provider: string;
  resourceId: string;
};

export type AllocatedPortRecord = {
  hostPort: number;
  target: string;
  guestPort: number;
  protocol: string;
};

export type SecretReferenceRecord = {
  target: string;
  purpose: string;
  store: string;
  name: string;
};

export type FactSnapshotRecord = {
  id: string;
  target: string;
  runId?: string;
  schemaVersion: string;
  capturedAt: string;
  data: unknown;
};

/** What kind of machine a target is: what a build for it has to be built for. */
export type MachinePlatformRecord = {
  platform: string;
  architecture: string;
};

/**
 * The image a target is pinned to: the file it was made from, not the name that was asked for.
 *
 * `reference` is kept beside the file so a changed blueprint is visible as such — asking for
 * `ubuntu:26.04` where the pin says `ubuntu:24.04` is a different intention, not a moved image.
 */
export type PinnedImageRecord = {
  reference: string;
  url: string;
  sha256: string;
  platform: string;
  architecture: string;
  format: string;
  boot: string;
};
