import type { Moment } from "./Moment.js";

/** What a snapshot is called. */
export class SnapshotId {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  /** The name of a snapshot being taken now of that machine. */
  static for(target: string, takenAt: Moment): SnapshotId {
    return new SnapshotId(`snap_${target}_${takenAt.stamp()}`);
  }

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
