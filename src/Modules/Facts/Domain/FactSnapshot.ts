import type { FactData, TransportFact } from "./FactModel.js";
import type { FactTarget } from "./FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const schemaVersion = "facts.v1";

/**
 * Keys a snapshot may never carry.
 *
 * A snapshot says what a machine is. Why it was read, how confident anyone is about it and where it
 * came from are properties of the reading, and letting them in is how a snapshot stops being
 * comparable to the next one.
 */
const forbiddenKeys = new Set([
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

/** Whether the reading that produced a snapshot got everything it asked for. */
export type ReadingStatus = "success" | "warning" | "error";

/**
 * How the snapshot came to be.
 *
 * Kept apart from the machine's own facts rather than mixed in with them: when a snapshot was taken
 * and whether the taking went cleanly are not things about the machine, and a requirement comparing
 * two snapshots must not trip over them.
 */
export type Reading = {
  startedAt: string;
  finishedAt: string;
  status: ReadingStatus;
  attempt: number;
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
 * A machine as it was read, once.
 *
 * Sections of data on their own are not something anyone can act on: two readings of the same
 * machine look alike, nothing says which shape they are in, and nothing says whether the reading
 * that produced them got everything it asked for. This is what makes them usable —
 *
 * - an identity, so it can be stored, referred to by a requirement result and named in a report;
 * - the schema it claims, so a reader can tell whether it understands the shape before trusting it;
 * - the reading that produced it: when it started and finished, which attempt it was, and whether
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
export class FactSnapshot {
  readonly id: string;
  readonly schemaVersion = schemaVersion;
  readonly scope: string;
  readonly target: { type: string; id: string; displayName?: string };
  readonly data: FactData;
  readonly reading: Reading;

  constructor(reading: FactReading) {
    // Named from the start of the reading, so the same machine read twice at the same instant is the
    // same snapshot and two readings never collide.
    const stamp = reading.startedAt.toISOString().replace(/[-:.]/g, "");

    this.id = `snap_${reading.target.name}_${stamp}`;
    this.scope = reading.target.scope;
    this.target = {
      type: reading.target.type,
      id: reading.target.name,
      displayName: reading.target.displayName,
    };
    this.data = { ...reading.data, transports: reading.transports };
    this.reading = {
      startedAt: reading.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: this.statusOf(this.data),
      attempt: reading.attempt ?? 1,
    };

    this.verify();
    deepFreeze(this);
  }

  /**
   * Whether the reading got everything it was asked for.
   *
   * A machine that could not be read at all never gets this far — that is an exception. What is left
   * is a machine that answered, where some declared thing failed: a command that would not run, a
   * path that failed what was required of it, a user found under another id. The snapshot is still
   * usable, so the reading is a warning rather than a failure, and the reason sits on the section
   * that failed.
   *
   * Found by walking the data rather than by a list of sections to look in. A list is a thing to
   * forget: `users` was added to the model and not to the list, and a snapshot holding a failed user
   * fact reported a clean reading.
   */
  private statusOf(value: unknown): ReadingStatus {
    if (!value || typeof value !== "object") {
      return "success";
    }

    if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
      return "warning";
    }

    return Object.values(value).some((property) => this.statusOf(property) === "warning")
      ? "warning"
      : "success";
  }

  private verify(): void {
    const issues = [...forbiddenKeys]
      .filter((key) => hasOwn(this, key))
      .map((key) => `a snapshot must not carry ${key}`);

    // An error belongs to the section that failed, so that the sections which answered stay usable.
    // A top-level bag of errors loses that.
    if (hasOwn(this.data, "errors")) {
      issues.push("data must not contain top-level errors");
    }

    if (issues.length > 0) {
      throw new InvalidSnapshotError(issues);
    }
  }
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
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
