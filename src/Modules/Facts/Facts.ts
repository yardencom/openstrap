import type { Transport } from "../../Transport/index.js";
import { FactSnapshot } from "./Domain/FactSnapshot.js";
import type { FactOrder } from "./Domain/FactOrder.js";
import type { TransportFact } from "./Domain/FactModel.js";
import { LocalReading } from "./Reading/LocalReading.js";
import { RemoteReading } from "./Reading/RemoteReading.js";
import type { SystemReading } from "./Reading/SystemReading.js";

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

  /** Reads the machine and returns one snapshot of it. */
  async collect(order: FactOrder): Promise<FactSnapshot> {
    const startedAt = order.now ?? new Date();
    const data = await this.reading.read(order.declare ?? {});

    // Both ends of the reading are measured here, because this is what waited for it.
    return new FactSnapshot({
      target: order.target,
      data,
      transports: this.transports(order),
      startedAt,
      finishedAt: new Date(),
      attempt: order.attempt,
    });
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
