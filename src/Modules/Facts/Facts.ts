import type { FactOrder } from "../../types/FactOrder.js";
import type { TargetScope, TargetType } from "../../types/Target.js";
import type { FactSections } from "../../types/Facts.js";
import type { Immutable } from "../../types/Immutable.js";
import type { FactsStatus } from "../../types/FactsStatus.js";
import { Collecting } from "./collect/Collecting.js";
import { FactSnapshot, schemaVersion } from "../../types/FactSnapshot.js";
import { Moment } from "../../types/Moment.js";

/** What a caller has to name to ask for facts. */
export type { FactOrder, FactChannel } from "../../types/FactOrder.js";
export type { Target } from "../../types/Target.js";
export { everySection, type FactDeclaration, type Asked } from "../../types/FactDeclaration.js";
export type { FactSections } from "../../types/Facts.js";
export type { FactsStatus } from "../../types/FactsStatus.js";
export type { FactSnapshot } from "../../types/FactSnapshot.js";


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
 * Nothing edits them afterwards, and that is said in the type — see `Immutable` — rather than done by
 * walking and freezing every section on every collection.
 *
 * The sections are its own properties rather than something it wraps, so the facts and their JSON are
 * one shape: `facts.os.name` here is `facts.os.name` in the snapshot openstrap printed on another
 * machine, and requirements are written against one spelling. That is what the interface below is
 * for — it gives the class the sections in the type system, the constructor gives them at runtime,
 * and methods are not enumerable, so they never reach the JSON.
 */
export interface Facts extends Immutable<FactSections> {}

export class Facts {
  private constructor(sections: FactSections) {
    Object.assign(this, sections);
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
   * A snapshot out of the JSON of one.
   *
   * The other way facts reach this openstrap: it delivers itself to a machine it cannot read from
   * here, and what comes back over the channel is the JSON a snapshot prints as. In it, the id, the
   * moment and the facts are plain strings and dictionaries, so the snapshot is built again with the
   * same constructors `collect` uses rather than cast into place — a cast would pass here and fail at
   * the first `facts.status()`, far from the channel that caused it.
   *
   * Two questions are asked of it and no others: is this openstrap's answer at all, and is it a
   * version this one reads. The first, because what comes over a channel is that machine's stdout and
   * it can hold a login banner, a truncated line or nothing. The second, because the build that
   * answered is a file in `bin/` and not necessarily built from this source — `OPENSTRAP_BINARY_DIR`
   * can point at a previous release, and then the two ends of the channel are two versions of
   * openstrap. Past those, the fields are read as the schema promises them. A build that claims this
   * schema and prints something else is a defect in openstrap, and finding it by having openstrap
   * inspect its own output field by field is checking the same code against itself.
   */
  static snapshotFrom(json: unknown): FactSnapshot {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new TypeError("Not a snapshot");
    }

    const printed = json as {
      schemaVersion?: unknown;
      scope: TargetScope;
      target: { type: TargetType; id: string; displayName?: string };
      facts: FactSections;
      reading: { takenAt: string };
    };

    if (printed.schemaVersion !== schemaVersion) {
      throw new TypeError(`A snapshot in ${JSON.stringify(printed.schemaVersion)}, which this openstrap does not read`);
    }

    return new FactSnapshot(
      {
        name: printed.target.id,
        scope: printed.scope,
        type: printed.target.type,
        displayName: printed.target.displayName,
      },
      new Facts(printed.facts),
      Moment.of(printed.reading.takenAt),
    );
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
    const failed = (value: unknown): boolean => {
      if (!value || typeof value !== "object") {
        return false;
      }

      return (value as { status?: unknown }).status === "error" || Object.values(value).some(failed);
    };

    return failed({ ...this }) ? "warning" : "success";
  }
}
