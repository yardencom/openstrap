import { readFileSync } from "node:fs";

import type { Transport } from "../Transport/index.js";
import { DeclaredFacts } from "./Definition/DeclaredFacts.js";
import { FactsDefinitionReader } from "./Definition/FactsDefinitionReader.js";
import { createFactCollection, type FactCollection } from "./Domain/FactCollection.js";
import type { DefinitionFactOrder, FactOrder } from "./Domain/FactOrder.js";
import type { FactData, FactRunStatus } from "./Domain/FactSnapshot.js";
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

  /**
   * @param transport How to reach the machine. Omitted for the machine openstrap
   * is running on, which is read in process — there is no local channel to open,
   * so there is none to pass.
   */
  constructor(transport?: Transport) {
    this.reading = transport === undefined ? new LocalReading() : new RemoteReading(transport);
  }

  /** Reads the machine and returns one snapshot of it, with the run that produced it. */
  async collect(order: FactOrder): Promise<FactCollection> {
    const startedAt = order.now ?? new Date();
    const stamp = startedAt.toISOString().replace(/[-:.]/g, "");
    const snapshotId = `snap_${order.target.name}_${stamp}`;
    const data = await this.reading.read(order.declare ?? {});

    return createFactCollection([{
      snapshot: {
        id: snapshotId,
        schemaVersion: "facts.v1",
        scope: order.target.scope,
        target: {
          type: order.target.type,
          id: order.target.name,
          displayName: order.target.displayName,
        },
        data: this.withTransport(data, order),
      },
      run: {
        id: `fact_run_${order.target.name}_${stamp}`,
        snapshotId,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        status: runStatus(data),
        attempt: order.attempt ?? 1,
      },
    }]);
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

    return {
      definition: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
      },
      facts: await this.collect({
        target: order.target,
        declare: declared.declaration,
        now: order.now,
        attempt: order.attempt,
      }),
      unread: declared.unread,
    };
  }

  /**
   * How the machine was reached, recorded beside what was found on it.
   *
   * No reading can work this out: the machine does not know how anyone got in.
   * It matters because a requirement can be written about the channel itself —
   * "this target is reachable over ssh with a key" — and because two snapshots
   * are only comparable when they were taken the same way.
   *
   * Only what the caller reported is recorded. This used to write
   * `authMethods: ["publickey"]` whenever the transport was named `ssh`, which
   * made `key-only-login` check a value openstrap had written from the blueprint's
   * own text: it would have passed on a connection authenticated by password.
   */
  private withTransport(data: FactData, order: FactOrder): FactData {
    return {
      ...data,
      transports: {
        [order.target.transport]: {
          status: "present",
          type: order.target.transport,
          ready: true,
          authMethods: order.target.authMethods === undefined ? undefined : [...order.target.authMethods],
        },
      },
    };
  }

}

/**
 * Whether the run got everything it was asked for.
 *
 * A machine that could not be read at all never reaches this point — that is an
 * exception, because there is no snapshot to report. What is left is a machine
 * that answered, where some declared thing failed: a command that would not run,
 * a path that failed what was required of it, a user found under another id. The
 * snapshot is still usable, so the run is a warning rather than a failure, and the
 * reason sits on the section that failed.
 *
 * Found by looking, not by a list of sections to look in. A list is a thing to
 * forget: `users` was added to the model and not to the list, and a snapshot with a
 * failed user fact in it reported a clean run.
 */
function runStatus(data: FactData): FactRunStatus {
  return reportsAnError(data) ? "warning" : "success";
}

function reportsAnError(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!Array.isArray(value) && (value as { status?: unknown }).status === "error") {
    return true;
  }

  return Object.values(value).some((property) => reportsAnError(property));
}
