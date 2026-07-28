import {
  factRunStatus,
  type FactData,
  type FactRun,
  type FactSnapshot,
  type TransportFact,
} from "./FactSnapshot.js";
import type { FactTarget } from "./FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const factsSchemaVersion = "facts.v1";

/**
 * One machine read, as a snapshot and the run that produced it.
 *
 * The unit of the model. There is nothing that has to hold of several of them together — every
 * rule is about one — so a list of them is a list and not a thing of its own to guard.
 */
export type FactCollectionItem = {
  snapshot: FactSnapshot<unknown>;
  run: FactRun;
};

/** Several machines read, one item each. */
export type FactCollection = readonly FactCollectionItem[];

/** One machine, as it was just read. */
export type FactReading = {
  target: FactTarget;
  data: FactData;
  /** The channel it was read through; empty when it was read in openstrap's own process. */
  transports: Record<string, TransportFact>;
  startedAt: Date;
  attempt?: number;
};

/**
 * Keys a snapshot may never carry.
 *
 * A snapshot says what a machine is. Why it was read, how confident anyone is about it and where
 * it came from are properties of the run that read it, and letting them into the snapshot is how
 * a snapshot stops being comparable to the next one.
 */
const forbiddenSnapshotKeys = new Set([
  "profile",
  "purpose",
  "provenance",
  "metadata",
  "sources",
  "confidence",
]);

export class FactCollectionValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid fact collection: ${issues.join("; ")}`);
    this.name = "FactCollectionValidationError";
    this.issues = issues;
  }
}

/**
 * The only way to get a read machine, and the only place it is checked.
 *
 * Everything that turns a reading into a snapshot happens here: its identity, the schema it
 * claims, which machine it is about, and the outcome of the run. Then every rule that has to hold
 * is checked and the result is frozen, so a snapshot cannot exist in an invalid state and cannot
 * be edited into one afterwards — anything downstream reads it without checking again.
 *
 * The rules were once checked over a list instead, which guarded nothing: no rule spans two
 * machines, and a caller reading several assembled the list itself, so the list that reached a
 * requirement check had never been near the check or the freeze.
 *
 * The names are stamped from the start of the run, so the same reading asked for twice at the same
 * instant is the same snapshot, and two readings never collide.
 */
export function createFactCollectionItem(reading: FactReading): FactCollectionItem {
  const stamp = reading.startedAt.toISOString().replace(/[-:.]/g, "");
  const snapshotId = `snap_${reading.target.name}_${stamp}`;
  const data = { ...reading.data, transports: reading.transports };
  const item: FactCollectionItem = {
    snapshot: {
      id: snapshotId,
      schemaVersion: factsSchemaVersion,
      scope: reading.target.scope,
      target: {
        type: reading.target.type,
        id: reading.target.name,
        displayName: reading.target.displayName,
      },
      data,
    },
    run: {
      id: `fact_run_${reading.target.name}_${stamp}`,
      snapshotId,
      startedAt: reading.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: factRunStatus(data),
      attempt: reading.attempt ?? 1,
    },
  };

  verify(item);

  return deepFreeze(item);
}

function verify(item: FactCollectionItem): void {
  const issues: string[] = [];

  if (item.run.snapshotId !== item.snapshot.id) {
    issues.push("run.snapshotId must match snapshot.id");
  }

  for (const key of forbiddenSnapshotKeys) {
    if (hasOwn(item.snapshot, key)) {
      issues.push(`snapshot must not contain ${key}`);
    }
  }

  // An error belongs to the section that failed, so that the sections which answered stay usable.
  // A top-level bag of errors loses that.
  if (isRecord(item.snapshot.data) && hasOwn(item.snapshot.data, "errors")) {
    issues.push("snapshot.data must not contain top-level errors");
  }

  if (issues.length > 0) {
    throw new FactCollectionValidationError(issues);
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const property of Object.values(value)) {
    deepFreeze(property);
  }

  return value;
}
