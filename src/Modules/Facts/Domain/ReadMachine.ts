import type {
  FactData,
  FactRun,
  FactRunStatus,
  FactSnapshot,
  TransportFact,
} from "./FactSnapshot.js";
import type { FactTarget } from "./FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const factsSchemaVersion = "facts.v1";

/**
 * Keys a snapshot may never carry.
 *
 * A snapshot says what a machine is. Why it was read, how confident anyone is about it and where it
 * came from are properties of the run that read it, and letting them into the snapshot is how a
 * snapshot stops being comparable to the next one.
 */
const forbiddenSnapshotKeys = new Set([
  "profile",
  "purpose",
  "provenance",
  "metadata",
  "sources",
  "confidence",
]);

/** What a reading came back with, before it is anything anyone can refer to. */
export type FactReading = {
  target: FactTarget;
  data: FactData;
  /** The channel it was read through; empty when it was read in openstrap's own process. */
  transports: Record<string, TransportFact>;
  startedAt: Date;
  attempt?: number;
};

export class InvalidSnapshotError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid fact snapshot: ${issues.join("; ")}`);
    this.name = "InvalidSnapshotError";
    this.issues = issues;
  }
}

/**
 * A machine that was read.
 *
 * Sections of data on their own are not something anyone can act on: two readings of the same
 * machine look alike, nothing says which shape they are in, and nothing says whether the reading
 * that produced them got everything it asked for. This is what makes them usable —
 *
 * - an identity, so a snapshot can be stored, referred to by a requirement result and named in a
 *   report;
 * - the schema it claims, so a reader can tell whether it understands the shape before trusting it;
 * - the run that produced it: when it started and finished, which attempt it was, and whether
 *   anything it asked for failed;
 * - the channel it came through, which no reading can know because a machine does not know how
 *   anyone got in.
 *
 * Then it is checked and frozen, so it cannot exist in an invalid state and cannot be edited into
 * one afterwards — everything downstream reads it without checking again.
 *
 * A constructor rather than a method, because nothing here waits: the machine has already answered
 * and this only turns the answer into something that can be trusted.
 */
export class ReadMachine {
  readonly snapshot: FactSnapshot<unknown>;
  readonly run: FactRun;

  constructor(reading: FactReading) {
    // Stamped from the start of the run, so the same reading asked for twice at the same instant is
    // the same snapshot and two readings never collide.
    const stamp = reading.startedAt.toISOString().replace(/[-:.]/g, "");
    const data = { ...reading.data, transports: reading.transports };

    this.snapshot = {
      id: `snap_${reading.target.name}_${stamp}`,
      schemaVersion: factsSchemaVersion,
      scope: reading.target.scope,
      target: {
        type: reading.target.type,
        id: reading.target.name,
        displayName: reading.target.displayName,
      },
      data,
    };
    this.run = {
      id: `fact_run_${reading.target.name}_${stamp}`,
      snapshotId: this.snapshot.id,
      startedAt: reading.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: this.runStatus(data),
      attempt: reading.attempt ?? 1,
    };

    this.verify();
    deepFreeze(this);
  }

  /**
   * Whether the run got everything it was asked for.
   *
   * A machine that could not be read at all never gets this far — that is an exception. What is left
   * is a machine that answered, where some declared thing failed: a command that would not run, a
   * path that failed what was required of it, a user found under another id. The snapshot is still
   * usable, so the run is a warning rather than a failure, and the reason sits on the section that
   * failed.
   *
   * Found by walking the snapshot rather than by a list of sections to look in. A list is a thing to
   * forget: `users` was added to the model and not to the list, and a snapshot holding a failed user
   * fact reported a clean run.
   */
  private runStatus(value: unknown): FactRunStatus {
    if (!value || typeof value !== "object") {
      return "success";
    }

    if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
      return "warning";
    }

    return Object.values(value).some((property) => this.runStatus(property) === "warning")
      ? "warning"
      : "success";
  }

  private verify(): void {
    const issues: string[] = [];

    if (this.run.snapshotId !== this.snapshot.id) {
      issues.push("run.snapshotId must match snapshot.id");
    }

    for (const key of forbiddenSnapshotKeys) {
      if (hasOwn(this.snapshot, key)) {
        issues.push(`snapshot must not contain ${key}`);
      }
    }

    // An error belongs to the section that failed, so that the sections which answered stay usable.
    // A top-level bag of errors loses that.
    if (isRecord(this.snapshot.data) && hasOwn(this.snapshot.data, "errors")) {
      issues.push("snapshot.data must not contain top-level errors");
    }

    if (issues.length > 0) {
      throw new InvalidSnapshotError(issues);
    }
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
