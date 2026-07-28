import type { FactData } from "./FactModel.js";
import type { FactTarget } from "./FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const schemaVersion = "facts.v1";

/** Whether the reading that produced a snapshot got everything it asked for. */
export type ReadingStatus = "success" | "warning" | "error";

/**
 * How the snapshot came to be: when it was taken, and whether the taking went cleanly.
 *
 * Named for the snapshot and not just `Reading`, because `Reading/` next door is the act of reading a
 * machine — `LocalReading`, `RemoteReading` — and one word cannot mean both the doing and the record
 * of what was done.
 *
 * Kept apart from the machine's own facts rather than mixed in with them, because neither is a thing
 * about the machine and a requirement comparing two snapshots must not trip over them.
 *
 * One moment and not a pair. A start and a finish look like an interval, but no interval is kept
 * anywhere: the finish was `takenAt` and the start only spelled out the snapshot's own name a second
 * time. How long the reading took is nobody's question yet, and if it becomes one it is a duration
 * and not two stamps to subtract.
 */
export type SnapshotReading = {
  takenAt: string;
  status: ReadingStatus;
};

/**
 * A machine as it was read, once.
 *
 * Sections of data on their own are not something anyone can act on: two readings of the same
 * machine look alike, nothing says which shape they are in, and nothing says whether the reading
 * that produced them got everything it asked for. This is what makes them usable —
 *
 * - an identity, so it can be stored, referred to by a requirement result and named in a report;
 * - the schema it claims, so a reader can tell whether it understands the shape before trusting it;
 * - the reading that produced it: when it was taken, and whether anything it asked for failed;
 * - the channel it came through, which no reading can know because a machine does not know how
 *   anyone got in.
 *
 * Then it is frozen, so it cannot be edited after the fact — everything downstream reads it as it
 * was taken. Nothing is checked, because there is nothing left that could be wrong: the fields are
 * fixed and the type says what may be in them, which no runtime check improves on.
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
  readonly reading: SnapshotReading;

  /**
   * @param takenAt When the machine was read. Given rather than read from the clock here, because
   * what waited for the reading knows when it came back and a constructor that stamped itself would
   * be dating the paperwork instead. It also names the snapshot, so the name and the time can never
   * disagree. The outcome is not given, because it follows from the data and nobody should be able to
   * disagree with it.
   */
  constructor(target: FactTarget, data: FactData, takenAt: Date) {
    this.id = `snap_${target.name}_${takenAt.toISOString().replace(/[-:.]/g, "")}`;
    this.scope = target.scope;
    this.target = { type: target.type, id: target.name, displayName: target.displayName };
    this.data = data;
    this.reading = {
      takenAt: takenAt.toISOString(),
      status: this.status(data),
    };

    this.freeze(this);
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
  private status(value: unknown): ReadingStatus {
    if (!value || typeof value !== "object") {
      return "success";
    }

    if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
      return "warning";
    }

    return Object.values(value).some((property) => this.status(property) === "warning")
      ? "warning"
      : "success";
  }

  private freeze(value: unknown): void {
    if (!value || typeof value !== "object") {
      return;
    }

    Object.freeze(value);

    for (const property of Object.values(value)) {
      this.freeze(property);
    }
  }
}
