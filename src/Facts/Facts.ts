import { readFileSync } from "node:fs";

import type { Transport } from "../Transport/index.js";
import { DeclaredFacts } from "./Definition/DeclaredFacts.js";
import { FactsDefinitionReader } from "./Definition/FactsDefinitionReader.js";
import {
  createFactCollection,
  createFactCollectionItem,
  type FactCollection,
} from "./Domain/FactCollection.js";
import type { FactDeclaration } from "./Domain/FactDeclaration.js";
import {
  ContradictoryFactOrderError,
  type FactDefinitionSource,
  type FactOrder,
} from "./Domain/FactOrder.js";
import type { TransportFact } from "./Domain/FactSnapshot.js";
import { LocalReading } from "./Reading/LocalReading.js";
import { RemoteReading } from "./Reading/RemoteReading.js";
import type { SystemReading } from "./Reading/SystemReading.js";

/** What one reading produced. */
export type CollectedFacts = {
  facts: FactCollection;
  /** Which definition the questions came from, when they came from one. */
  definition?: {
    id: string;
    version: number;
    description: string;
  };
  /** Sections the questions named that no reading answers. */
  unread: readonly string[];
};

/**
 * Facts about a machine.
 *
 * The only way into this module, and `collect` is the only way to read: an instance
 * is made by naming the machine — with no transport it reads the one it is running
 * on, with a transport the one at the other end — and then asked once.
 *
 * There is no second entry point and no way to reach a collector, a reading or a
 * section from outside, because a fact only means anything together with how it was
 * obtained. A caller able to assemble its own reading could produce a snapshot
 * nothing else in openstrap would be entitled to trust.
 *
 * Reading is a method rather than a constructor: reaching a machine can mean
 * waiting on a network, and a constructor cannot wait.
 */
export class Facts {
  private readonly reading: SystemReading;
  private readonly channelWasOpened: boolean;

  /**
   * @param transport How to reach the machine. Omitted for the machine openstrap
   * is running on, which is read in process — there is no local channel to open,
   * so there is none to pass.
   */
  constructor(transport?: Transport) {
    this.channelWasOpened = transport !== undefined;
    this.reading = transport === undefined ? new LocalReading() : new RemoteReading(transport);
  }

  /** Reads the machine and returns one snapshot of it, with the run that produced it. */
  async collect(order: FactOrder): Promise<CollectedFacts> {
    const startedAt = order.now ?? new Date();
    const asked = this.questions(order);
    const data = await this.reading.read(asked.declare);

    return {
      facts: createFactCollection([createFactCollectionItem({
        target: order.target,
        data,
        transports: this.transports(order),
        startedAt,
        attempt: order.attempt,
      })]),
      definition: asked.definition,
      unread: asked.unread,
    };
  }

  /**
   * What to ask the machine, from whichever place the order named it.
   *
   * A definition file is read here rather than by the caller because a declaration
   * only means something together with the reading it was written for: a caller that
   * parsed the file itself would be free to ask for one thing and report another.
   */
  private questions(order: FactOrder): {
    declare: FactDeclaration;
    definition?: CollectedFacts["definition"];
    unread: readonly string[];
  } {
    if (order.declare !== undefined && order.definition !== undefined) {
      throw new ContradictoryFactOrderError();
    }

    if (order.definition === undefined) {
      return { declare: order.declare ?? {}, unread: [] };
    }

    return this.declared(order.definition);
  }

  private declared(source: FactDefinitionSource): {
    declare: FactDeclaration;
    definition: NonNullable<CollectedFacts["definition"]>;
    unread: readonly string[];
  } {
    const definition = new FactsDefinitionReader().parseYaml(readFileSync(source.path, "utf8"));
    const declared = new DeclaredFacts({
      definition,
      overrides: source.inputs,
      workspaceRoot: source.workspaceRoot,
    });

    return {
      declare: declared.declaration,
      definition: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
      },
      unread: declared.unread,
    };
  }

  /**
   * The `transports` section: the channel this snapshot was read through, when
   * there was one.
   *
   * No reading can work this out: the machine does not know how anyone got in. It
   * matters because a requirement can be written about the channel itself, and
   * because two snapshots are only comparable when they were taken the same way.
   *
   * `present` and `ready` are evidence rather than assertion — this runs only after
   * a reading came back through that channel, and a channel that was not there
   * would have thrown instead. There is nothing here when openstrap read the
   * machine in its own process: no channel was opened, so naming one would be
   * inventing it, and a requirement about a `local` transport was passing against
   * exactly that invention.
   */
  private transports(order: FactOrder): Record<string, TransportFact> {
    if (!this.channelWasOpened) {
      return {};
    }

    return {
      [order.target.transport]: {
        status: "present",
        type: order.target.transport,
        ready: true,
        authMethods: order.target.authMethods === undefined ? undefined : [...order.target.authMethods],
      },
    };
  }
}
