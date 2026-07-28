import type { FactData } from "./FactModel.js";
import type { FactTarget } from "./FactTarget.js";

/** Which shape of snapshot this is. Every reader compares against it before trusting one. */
const schemaVersion = "facts.v1";

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

/**
 * A machine as it was read, once.
 *
 * Sections of data on their own are not something anyone can act on: two readings of the same
 * machine look alike, nothing says which shape they are in, and nothing says whether the reading
 * that produced them got everything it asked for. This is what makes them usable —
 *
 * - an identity, so it can be stored, referred to by a requirement result and named in a report;
 * - the schema it claims, so a reader can tell whether it understands the shape before trusting it;
 * - the reading that produced it: when it ran, which attempt it was, and whether anything it asked
 *   for failed;
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
  readonly reading: Reading;

  /**
   * @param reading When the reading ran and which attempt it was. Both times are given rather than
   * taken from the clock here: a snapshot is made after the reading has finished, so it could
   * observe the end and never the beginning, and half a measurement is not a measurement. The
   * outcome is not given, because it follows from the data and nobody should be able to disagree
   * with it.
   */
  constructor(
    target: FactTarget,
    data: FactData,
    reading: { startedAt: Date; finishedAt: Date; attempt?: number },
  ) {
    // Named from the start of the reading, so the same machine read twice at the same instant is the
    // same snapshot and two readings never collide.
    const stamp = reading.startedAt.toISOString().replace(/[-:.]/g, "");

    this.id = `snap_${target.name}_${stamp}`;
    this.scope = target.scope;
    this.target = { type: target.type, id: target.name, displayName: target.displayName };
    this.data = data;
    this.reading = {
      startedAt: reading.startedAt.toISOString(),
      finishedAt: reading.finishedAt.toISOString(),
      status: this.status(data),
      attempt: reading.attempt ?? 1,
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
