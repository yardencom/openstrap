import type { FactOrder } from "./domain/FactOrder.js";
import type { FactSections } from "./domain/FactModel.js";
import type { FactsStatus } from "./domain/FactStatus.js";
import { Collecting } from "./collect/Collecting.js";
import { FactSnapshot, schemaVersion } from "./FactSnapshot.js";
import { Moment } from "./domain/Moment.js";

/** What a caller has to name to ask for facts. */
export type { FactOrder, FactChannel } from "./domain/FactOrder.js";
export type { FactTarget } from "./domain/FactTarget.js";
export type { FactDeclaration } from "./domain/FactDeclaration.js";
export type { FactSections } from "./domain/FactModel.js";
export type { FactsStatus } from "./domain/FactStatus.js";
export type { FactSnapshot } from "./FactSnapshot.js";


/**
 * The facts about the machine this is running on.
 *
 * One type, and it is the thing it is named after. `Facts.collect()` is the way in — it runs every
 * collector and hands back the facts — and what it hands back is an instance of this, not a bag of
 * sections somebody else has to make sense of. That matters because there is a question only the
 * facts can answer, whether everything asked for came back, and the answer has to live where the
 * sections are; it used to be worked out by whatever happened to be carrying them.
 *
 * There is one way to collect and it does not know where it is running. No local case and no remote
 * case: a machine openstrap is not on is read by openstrap being put there and asked this same
 * question. That is what makes two collections comparable — not agreement between two
 * implementations, but the absence of a second one.
 *
 * Every value comes from an API — systeminformation, `node:os`, `node:fs`, PATH resolution — and
 * never from openstrap parsing the output of a program it chose to run. The two exceptions are stated
 * where they are made: whether `sudo` runs without a password, and programs the caller declared.
 *
 * The sections are its own properties rather than something it wraps, so the facts and their JSON are
 * one shape: `facts.os.name` here is `facts.os.name` in the snapshot openstrap printed on another
 * machine, and requirements are written against one spelling. That is what the interface below is
 * for — it gives the class the sections in the type system, the constructor gives them at runtime,
 * and methods are not enumerable, so they never reach the JSON.
 */
export interface Facts extends FactSections {}

export class Facts {
  private constructor(sections: FactSections) {
    Object.assign(this, sections);

    freeze(this);
  }

  /**
   * Reads this machine, and hands back a snapshot of it.
   *
   * The way into this module and the only one. It runs every collector, makes the facts out of what
   * they answered, and names them: which machine the caller was asking about and when. A caller left
   * to do the naming itself is a caller that can name the same collection two ways.
   *
   * A method and not a constructor, because reading waits and a constructor cannot.
   */
  static async collect(order: FactOrder): Promise<FactSnapshot> {
    const facts = new Facts(await new Collecting().read(order));

    return new FactSnapshot(
      order.target,
      facts,
      order.now === undefined ? Moment.now() : new Moment(order.now),
    );
  }

  /**
   * A snapshot openstrap took on another machine and printed, read back into these types.
   *
   * The other way facts reach this openstrap, and it is the same module's job: openstrap delivers
   * itself to a machine it cannot read from here, and what comes back over the channel is text. Text
   * is not a snapshot — the id that knows how it is spelled, the moment with both of its spellings,
   * the facts that can say whether they are complete are all lost in it — so it is put back together
   * rather than passed on as a lookalike.
   */
  static printed(output: unknown): FactSnapshot {
    const printed = shapeOf(output);
    const snapshot = new FactSnapshot(
      {
        name: String(printed.target?.id),
        scope: String(printed.scope),
        type: String(printed.target?.type),
        displayName: printed.target?.displayName === undefined ? undefined : String(printed.target.displayName),
      },
      // Made facts again, and not judged again: openstrap collected them, and a second opinion here
      // would be a second implementation.
      new Facts(printed.facts),
      Moment.of(printed.takenAt),
    );

    // A snapshot whose name does not follow from its own contents is one the state store and a
    // requirement result would disagree about.
    if (String(snapshot.id) !== printed.id) {
      throw new TypeError(`A snapshot called ${JSON.stringify(printed.id)}, which is not what ${snapshot.id} is called`);
    }

    return snapshot;
  }

  /**
   * Whether everything asked for came back.
   *
   * A machine that could not be read at all never gets this far — that is an exception. What is left
   * is a machine that answered, where some declared thing failed: a command that would not run, a
   * path that failed what was required of it, a user found under another id. The facts are still
   * usable, so it is a warning rather than a failure, and the reason sits on the section that failed.
   *
   * Found by walking the sections rather than by a list of them to look in. A list is a thing to
   * forget: `users` was added to the model and not to the list, and facts holding a failed user read
   * as a clean collection.
   */
  status(): FactsStatus {
    return statusOf({ ...this });
  }
}

function statusOf(value: unknown): FactsStatus {
  if (!value || typeof value !== "object") {
    return "success";
  }

  if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
    return "warning";
  }

  return Object.values(value).some((property) => statusOf(property) === "warning") ? "warning" : "success";
}

function freeze(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  Object.freeze(value);

  for (const property of Object.values(value)) {
    freeze(property);
  }
}
/**
 * What openstrap printed, checked far enough to be worth rebuilding.
 *
 * Only what a reader could otherwise be wrong about: the shape it claims, and that the pieces a
 * snapshot cannot exist without are there. Anything more would be judging facts openstrap collected.
 */
function shapeOf(output: unknown): {
  id: string;
  takenAt: string;
  scope: unknown;
  target?: { type?: unknown; id?: unknown; displayName?: unknown };
  facts: FactSections;
} {
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

  if (!printed.facts || typeof printed.facts !== "object" || Array.isArray(printed.facts)) {
    throw new TypeError("A snapshot with no facts in it");
  }

  return {
    id: printed.id,
    takenAt: printed.reading.takenAt,
    scope: printed.scope,
    target: printed.target,
    facts: printed.facts as FactSections,
  };
}

