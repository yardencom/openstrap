import type { Transport } from "../Transport/index.js";
import { DeclaredEntities } from "./Collectors/DeclaredEntities.js";
import { SystemInventory } from "./Collectors/SystemInventory.js";
import { createFactCollection } from "./Domain/FactCollectionFactory.js";
import type { FactCollectionItem } from "./Domain/Facts.js";

/**
 * What the facts module needs to know about a machine.
 *
 * Deliberately a plain shape of its own rather than a blueprint target. This
 * module does not know that blueprints exist — it reads a machine and says
 * what it found, which is a thing worth having with or without openstrap.
 */
export type FactTarget = {
  name: string;
  scope: string;
  type: string;
  displayName?: string;
  transport: string;
};

export type FactCollectionOrder = {
  transport: Transport;
  target: FactTarget;
  /** Sections to read; everything cheap is read when omitted. */
  sections?: readonly string[];
  tools?: readonly string[];
  paths?: Record<string, string>;
  now?: Date;
  attempt?: number;
};

/**
 * Facts about machines: both the reading of them and the result.
 *
 * One module does both. Splitting "the collector" from "the collection" would
 * give two things that are useless apart, and the reading is what makes the
 * result trustworthy.
 *
 * Reading is done through an API rather than a constructor, because reaching a
 * machine can mean waiting on a network and a constructor cannot wait.
 */
export class Facts extends Array<FactCollectionItem> {
  constructor(items: readonly FactCollectionItem[] = []) {
    super();

    if (Array.isArray(items)) {
      this.push(...createFactCollection(items));
    }
  }

  /**
   * Answers, by name, the entities a caller declared.
   *
   * The inventory is keyed by identity — a pid, a unit name. A caller asks
   * "is node running". Both are facts about the same machine, so both belong
   * in the same snapshot, and the matching lives here rather than in every
   * caller that needs it.
   */
  static answerDeclarations(
    data: Record<string, any>,
    selectors: Readonly<Record<string, unknown>>,
  ): Record<string, any> {
    const declared = new DeclaredEntities();
    const answered = { ...data };

    if (selectors.processes) {
      answered.processes = { ...data.processes, ...declared.processes(selectors.processes as never, data.processes ?? {}) };
    }

    if (selectors.services) {
      answered.services = { ...data.services, ...declared.services(selectors.services as never, data.services ?? {}) };
    }

    return answered;
  }

  /**
   * Reads a machine over a transport.
   *
   * The host is not a special case. It is a machine reached by the local
   * transport, and it goes through exactly this method.
   */
  static async read(order: FactCollectionOrder): Promise<Facts> {
    const startedAt = (order.now ?? new Date()).toISOString();
    const stamp = startedAt.replace(/[-:.]/g, "");
    const data = await SystemInventory.from(order.transport).read({
      sections: order.sections,
      tools: order.tools,
      paths: order.paths,
    });
    const snapshotId = `snap_${order.target.name}_${stamp}`;

    // Which channel reached this machine is known by the caller, not by the
    // commands that ran over it — so it is recorded here rather than guessed.
    data.transports = {
      [order.target.transport]: {
        status: "present",
        type: order.target.transport,
        ready: true,
        authMethods: order.target.transport === "ssh" ? ["publickey"] : undefined,
      },
    };

    return new Facts([{
      snapshot: {
        id: snapshotId,
        schemaVersion: "facts.v1",
        scope: order.target.scope,
        target: {
          type: order.target.type,
          id: order.target.name,
          displayName: order.target.displayName,
        },
        data,
      },
      run: {
        id: `fact_run_${order.target.name}_${stamp}`,
        snapshotId,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: "success",
        attempt: order.attempt ?? 1,
      },
    }]);
  }
}
