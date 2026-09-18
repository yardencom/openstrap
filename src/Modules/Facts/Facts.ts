import type { FactOrder } from "#types/FactOrder.js";
import type { TargetScope, TargetType } from "#types/Target.js";
import type { FactSections } from "#types/Facts.js";
import type { Immutable } from "#types/Immutable.js";
import type { FactsStatus } from "#types/FactsStatus.js";
import { Collecting } from "./collect/Collecting.js";
import { FactSnapshot, schemaVersion } from "#types/FactSnapshot.js";
import { Moment } from "#types/Moment.js";

/** What a caller has to name to ask for facts. */
export type { FactOrder, FactChannel } from "#types/FactOrder.js";
export type { Target } from "#types/Target.js";
export { everySection, type FactDeclaration, type Asked } from "#types/FactDeclaration.js";
export type { FactSections } from "#types/Facts.js";
export type { FactsStatus } from "#types/FactsStatus.js";
export type { FactSnapshot } from "#types/FactSnapshot.js";


/** The facts about the machine this is running on. */
export interface Facts extends Immutable<FactSections> {}

export class Facts {
  private constructor(sections: FactSections) {
    Object.assign(this, sections);
  }

  /** Reads this machine and hands back a snapshot: the way into this module and the only one. */
  static async collect(order: FactOrder): Promise<FactSnapshot> {
    const facts = new Facts(await new Collecting().read(order));

    return new FactSnapshot(
      order.target,
      facts,
      order.now === undefined ? Moment.now() : new Moment(order.now),
    );
  }

  /** A snapshot out of the JSON of one. */
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

  /** Whether everything asked for came back. */
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
