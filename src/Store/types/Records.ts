import type { TargetScope, TargetType } from "#types/Target.js";

export type TargetRecord = {
  name: string;
  scope: TargetScope;
  type: TargetType;
  provider?: string;
  /** What reached this machine, once something has. */
  transport?: string;
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

export type FactSnapshotRecord = {
  id: string;
  target: string;
  runId?: string;
  schemaVersion: string;
  capturedAt: string;
  data: unknown;
};

/** The image a target was made from: the file, not the name that was asked for. */
export type MachineImageRecord = {
  reference: string;
  url: string;
  sha256?: string;
  platform: string;
  architecture: string;
  format: string;
  boot: string;
};

/** The image one run built with, as data rather than as a sentence in a step. */
export type RunImageRecord = {
  reference: string;
  url: string;
  sha256?: string;
};

/**
 * A run this machine has and a server has not, with everything needed to tell it about it.
 *
 * The blueprint as it was, the file the machine was made from, its id at the provider, the steps and
 * the reading — gathered here because a run is told in one go and these are five tables.
 */
export type CarriedRunCandidate = {
  id: string;
  target: string;
  command: string;
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt?: string;
  /** The blueprint this run was against, as it was written then. */
  declaration?: unknown;
  /** What kind of machine it is, which the blueprint never said: the provider did. */
  recorded?: TargetRecord;
  /** The pin as it stands, which is what a first telling proposes to a server that has none. */
  image?: MachineImageRecord;
  /** What this run itself built with, which a repin since then has moved the pin away from. */
  builtWith?: RunImageRecord;
  steps: readonly RunStepRecord[];
  snapshot?: FactSnapshotRecord;
  requirementRun?: RequirementRunRecord;
};

/** How a machine measured up against what was required of it. */
export type RequirementRunRecord = {
  id: string;
  target: string;
  runId?: string;
  status: string;
  evaluatedAt: string;
  results: unknown;
};
