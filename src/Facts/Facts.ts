import { readFileSync } from "node:fs";

import type { Transport } from "../Transport/index.js";
import { DeclaredFacts } from "./Definition/DeclaredFacts.js";
import { FactsDefinitionReader } from "./Definition/FactsDefinitionReader.js";
import {
  createFactCollection,
  createFactCollectionItem,
  type FactCollection,
} from "./Domain/FactCollection.js";
import type { DefinitionFactOrder, FactOrder } from "./Domain/FactOrder.js";
import type { TransportFact } from "./Domain/FactSnapshot.js";
import { LocalReading } from "./Reading/LocalReading.js";
import { RemoteReading } from "./Reading/RemoteReading.js";
import type { SystemReading } from "./Reading/SystemReading.js";

/** What reading a machine against a definition file produces. */
export type DefinedFacts = {
  definition: {
    id: string;
    version: number;
    description: string;
  };
  facts: FactCollection;
  /** Sections the definition declared that no reading answers. */
  unread: readonly string[];
};

/**
 * Facts about a machine.
 *
 * The only way into this module. Everything it can do is on an instance, and an
 * instance is made by naming the machine to read: with no transport it reads the
 * one it is running on, with a transport it reads the one at the other end.
 *
 * There is no second entry point and no way to reach a collector, a reading or a
 * section from outside, because a fact only means anything together with how it
 * was obtained. A caller able to assemble its own reading could produce a
 * snapshot nothing else in openstrap would be entitled to trust.
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
  async collect(order: FactOrder): Promise<FactCollection> {
    const startedAt = order.now ?? new Date();
    const data = await this.reading.read(order.declare ?? {});

    return createFactCollection([createFactCollectionItem({
      target: order.target,
      data,
      transports: this.transports(order),
      startedAt,
      attempt: order.attempt,
    })]);
  }

  /**
   * Reads the machine, asking what a facts definition file says to ask.
   *
   * The definition is read here rather than by the caller because a declaration
   * is only meaningful together with the reading it was written for: a caller
   * that parsed the file itself would be free to ask for one thing and report
   * another.
   */
  async collectFromDefinition(order: DefinitionFactOrder): Promise<DefinedFacts> {
    const definition = new FactsDefinitionReader().parseYaml(readFileSync(order.path, "utf8"));
    const declared = new DeclaredFacts({
      definition,
      overrides: order.inputs,
      workspaceRoot: order.workspaceRoot,
    });

    const facts = await this.collect({
      target: order.target,
      declare: declared.declaration,
      now: order.now,
      attempt: order.attempt,
    });

    return {
      definition: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
      },
      facts,
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
