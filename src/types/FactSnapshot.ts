import type { FactSections } from "./Facts.js";
import type { Immutable } from "./Immutable.js";
import type { Target } from "./Target.js";
import type { FactsStatus } from "./FactsStatus.js";
import type { Moment } from "./Moment.js";
import { SnapshotId } from "./SnapshotId.js";

/**
 * Facts as a snapshot needs them: the sections, and their own answer about whether everything asked for came
 * back.
 */
export type SnapshotFacts = Immutable<FactSections> & { status(): FactsStatus };

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
export const schemaVersion = "facts.v1";

/** How the snapshot came to be: when it was taken, and whether the taking went cleanly. */
export type SnapshotReading = {
  takenAt: Moment;
  status: FactsStatus;
};

/** A machine as it was read, once. */
export class FactSnapshot {
  readonly id: SnapshotId;
  readonly schemaVersion = schemaVersion;
  readonly scope: string;
  readonly target: Immutable<{ type: string; id: string; displayName?: string }>;
  readonly facts: SnapshotFacts;
  readonly reading: Immutable<SnapshotReading>;

  /** @param takenAt When the machine was read. */
  constructor(target: Target, facts: SnapshotFacts, takenAt: Moment) {
    this.id = SnapshotId.for(target.name, takenAt);
    this.scope = target.scope;
    this.target = { type: target.type, id: target.name, displayName: target.displayName };
    this.facts = facts;
    this.reading = { takenAt, status: facts.status() };
  }

}
