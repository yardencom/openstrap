import type { FactSections } from "./types/FactModel.js";
import type { Immutable } from "./types/Immutable.js";
import type { FactTarget } from "./types/FactTarget.js";
import type { FactsStatus } from "./types/FactStatus.js";
import type { Moment } from "./Moment.js";
import { SnapshotId } from "./SnapshotId.js";

/**
 * Facts as a snapshot needs them: the sections, and their own answer about whether everything asked
 * for came back.
 *
 * Spelled as what a snapshot needs rather than imported from what provides it. `Facts` is what makes
 * a snapshot, so a snapshot naming `Facts` back would be two files each needing the other to be read;
 * and what a snapshot depends on is not who collected the facts.
 */
export type SnapshotFacts = Immutable<FactSections> & { status(): FactsStatus };

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
export const schemaVersion = "facts.v1";

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
 * putting together. Everything downstream reads it as it was taken, which the types say and no
 * runtime freezing has to enforce.
 *
 * A constructor rather than a method, because nothing here waits: the machine has already answered
 * and this only turns the answer into something that can be trusted.
 */
export class FactSnapshot {
  readonly id: SnapshotId;
  readonly schemaVersion = schemaVersion;
  readonly scope: string;
  readonly target: Immutable<{ type: string; id: string; displayName?: string }>;
  readonly facts: SnapshotFacts;
  readonly reading: Immutable<SnapshotReading>;

  /**
   * @param takenAt When the machine was read. Given rather than read from the clock here, because
   * what waited for the collection knows when it came back, and a constructor that stamped itself
   * would be dating the paperwork instead. It also names the snapshot, so the name and the time can
   * never disagree. The outcome is not given, because the facts answer it and nobody should be able
   * to disagree with them.
   */
  constructor(target: FactTarget, facts: SnapshotFacts, takenAt: Moment) {
    this.id = SnapshotId.for(target.name, takenAt);
    this.scope = target.scope;
    this.target = { type: target.type, id: target.name, displayName: target.displayName };
    this.facts = facts;
    this.reading = { takenAt, status: facts.status() };
  }

}
