import type { Moment } from "./Moment.js";

/**
 * What a snapshot is called.
 *
 * A type of its own because the name is not free text: it is the machine it is about and the moment
 * it was taken, in that order, and everything downstream — the state store, a requirement result, a
 * report — refers to a snapshot by it. Made here and nowhere else, so no caller has to know the shape
 * and none can spell it differently.
 */
export class SnapshotId {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  /** The name of a snapshot being taken now of that machine. */
  static for(target: string, takenAt: Moment): SnapshotId {
    return new SnapshotId(`snap_${target}_${takenAt.stamp()}`);
  }

  /** An id as it came back from JSON, which is the text of one. */
  static of(value: string): SnapshotId {
    if (!value.startsWith("snap_")) {
      throw new TypeError(`Not a snapshot id: ${JSON.stringify(value)}`);
    }

    return new SnapshotId(value);
  }

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
