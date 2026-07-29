import { Facts, type FactsStatus } from "./Facts.js";
import { Moment } from "./domain/Moment.js";
import { SnapshotId } from "./domain/SnapshotId.js";
import type { FactTarget } from "./domain/FactTarget.js";

/**
 * What a caller needs to make or read a snapshot.
 *
 * A moment is here rather than somewhere of its own to be found, because a snapshot cannot be made
 * without one: the two names a caller spells are the snapshot and the moment it was taken.
 */
export { Moment } from "./domain/Moment.js";
export type { SnapshotId } from "./domain/SnapshotId.js";
export type { FactTarget } from "./domain/FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const schemaVersion = "facts.v1";

/**
 * How the snapshot came to be: when it was taken, and whether the taking went cleanly.
 *
 * One moment and not a pair. A start and a finish look like an interval, but no interval is kept
 * anywhere: the finish was `takenAt` and the start only spelled out the snapshot's own name a second
 * time. How long collecting took is nobody's question yet, and if it becomes one it is a duration and
 * not two stamps to subtract.
 */
export type SnapshotReading = {
  takenAt: Moment;
  status: FactsStatus;
};

/**
 * A machine as it was read, once.
 *
 * Facts on their own are not something anyone can act on: two collections of the same machine look
 * alike, nothing says which shape they are in, and nothing says which machine anyone was asking
 * about. This is what makes them usable —
 *
 * - an identity, so it can be stored, referred to by a requirement result and named in a report;
 * - the schema it claims, so a reader can tell whether it understands the shape before trusting it;
 * - when it was taken, and how the taking went;
 * - which machine it is about, under the name the caller knows it by.
 *
 * Each of those is a type of its own rather than a string: an id knows how it is spelled, a moment
 * knows both of its spellings, and the facts know whether they are complete. What is left here is the
 * putting together, and then it is frozen — everything downstream reads it as it was taken.
 *
 * A constructor rather than a method, because nothing here waits: the machine has already answered
 * and this only turns the answer into something that can be trusted.
 */
export class FactSnapshot {
  readonly id: SnapshotId;
  readonly schemaVersion = schemaVersion;
  readonly scope: string;
  readonly target: { type: string; id: string; displayName?: string };
  readonly facts: Facts;
  readonly reading: SnapshotReading;

  /**
   * @param takenAt When the machine was read. Given rather than read from the clock here, because
   * what waited for the collection knows when it came back, and a constructor that stamped itself
   * would be dating the paperwork instead. It also names the snapshot, so the name and the time can
   * never disagree. The outcome is not given, because the facts answer it and nobody should be able
   * to disagree with them.
   */
  constructor(target: FactTarget, facts: Facts, takenAt: Moment) {
    this.id = SnapshotId.for(target.name, takenAt);
    this.scope = target.scope;
    this.target = { type: target.type, id: target.name, displayName: target.displayName };
    this.facts = facts;
    this.reading = { takenAt, status: facts.status() };

    Object.freeze(this.target);
    Object.freeze(this.reading);
    Object.freeze(this);
  }

  /**
   * A snapshot openstrap took on another machine and printed, read back into the same types.
   *
   * The one way in from outside, and it exists because openstrap delivers itself to machines it
   * cannot read from here: what comes back over the channel is text. Text is not a snapshot — the id
   * that knows how it is spelled, the moment with both of its spellings, the facts that can say
   * whether they are complete are all lost in it — so it is put back together rather than passed on as
   * a lookalike.
   *
   * Checked is what a reader could otherwise be wrong about: the shape it claims, and that its name
   * is the name this machine and this moment produce. A snapshot whose name does not follow from its
   * own contents is one the state store and a requirement result would disagree about. The facts
   * themselves are not judged again — openstrap collected them, and a second opinion here would be a
   * second implementation.
   */
  static printed(output: unknown): FactSnapshot {
    if (!output || typeof output !== "object" || Array.isArray(output)) {
      throw new TypeError("Not a snapshot");
    }

    const printed = output as {
      schemaVersion?: unknown;
      id?: unknown;
      scope?: unknown;
      target?: { type?: unknown; id?: unknown; displayName?: unknown };
      facts?: unknown;
      reading?: { takenAt?: unknown };
    };

    if (printed.schemaVersion !== schemaVersion) {
      throw new TypeError(`A snapshot in ${JSON.stringify(printed.schemaVersion)}, which this openstrap does not read`);
    }

    if (typeof printed.id !== "string" || typeof printed.reading?.takenAt !== "string") {
      throw new TypeError("A snapshot with no name, or none of the moment it was taken");
    }

    const snapshot = new FactSnapshot(
      {
        name: String(printed.target?.id),
        scope: String(printed.scope),
        type: String(printed.target?.type),
        displayName: printed.target?.displayName === undefined ? undefined : String(printed.target.displayName),
      },
      Facts.of(printed.facts),
      Moment.of(printed.reading.takenAt),
    );

    if (String(snapshot.id) !== printed.id) {
      throw new TypeError(`A snapshot called ${JSON.stringify(printed.id)}, which is not what ${snapshot.id} is called`);
    }

    return snapshot;
  }
}
