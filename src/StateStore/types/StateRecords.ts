import type { TargetScope, TargetType } from "../../types/Target.js";

export type TargetRecord = {
  name: string;
  scope: TargetScope;
  type: TargetType;
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

/**
 * The image a target was made from: the file, not the name that was asked for.
 *
 * One record for two questions with one answer — what `create` must build from again, and what
 * openstrap has to be built for to run on that machine.
 */
export type MachineImageRecord = {
  reference: string;
  url: string;
  sha256: string;
  platform: string;
  architecture: string;
  format: string;
  boot: string;
};

/** The image one run built with, as data rather than as a sentence in a step. */
export type RunImageRecord = {
  reference: string;
  url: string;
  sha256: string;
};
