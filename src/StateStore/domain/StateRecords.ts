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
