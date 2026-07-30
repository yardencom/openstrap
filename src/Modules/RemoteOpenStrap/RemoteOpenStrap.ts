import { RemoteOpenStrapError } from "./errors/RemoteOpenStrapError.js";
import type { Transport } from "../../Transport/index.js";
import { Facts, type FactOrder, type FactSnapshot } from "../Facts/Facts.js";
import { OpenStrapBinary } from "./deliver/OpenStrapBinary.js";
import type { MachinePlatform } from "../../types/Machine.js";


/**
 * openstrap on a machine openstrap is not running on.
 *
 * A machine cannot be read from outside itself: the host's APIs answer about the host, and reading a
 * guest by parsing the output of the guest's own programs would be a second implementation of facts,
 * drifting from the first. So openstrap goes there. It delivers itself over the transport, runs
 * itself, and hands back the snapshot it took — taken by the same code, so it means the same thing as
 * one taken here.
 *
 * There is no fact collecting in this module. Facts belong to the facts module and are collected one
 * way, on the machine, knowing nothing about where that is. This is delivery, which is why it lives
 * outside that module and why that module has never heard of a transport.
 */
export class RemoteOpenStrap {
  /**
   * @param machine What kind of machine this is, as it was recorded when openstrap created it. Told
   * rather than found out: a build for one platform does not run on another, and the machine cannot
   * be asked before openstrap is on it.
   */
  constructor(
    private readonly transport: Transport,
    private readonly machine: MachinePlatform,
  ) {}

  /** Puts openstrap on the target, has it read the machine, and returns the snapshot it took. */
  async collect(order: FactOrder): Promise<FactSnapshot> {
    const openstrap = await new OpenStrapBinary(this.machine).deliverTo(this.transport.fileSystem);
    const result = await this.transport.processes.capture({
      command: openstrap,
      args: ["facts", "collect", "host", "--json", "--order", encodeOrder(order)],
      // Nowhere in particular: openstrap is being asked to read this machine, not to work in a
      // directory, and a directory it has no business writing to is one more way to fail.
      cwd: "/",
    });

    if (result.exitCode !== 0) {
      throw new RemoteOpenStrapError(result.stderr.trim() || `exit ${result.exitCode}`);
    }

    return this.snapshotIn(result.stdout);
  }

  /**
   * What openstrap printed over there, which is one snapshot.
   *
   * Read back into the types a snapshot is made of rather than cast into a lookalike of one: what
   * came over the channel is text, and the snapshot knows how to be itself again. Anything
   * unparseable is a failure rather than an empty reading — a machine that answered with noise has
   * not been read, and reporting no facts would make that look like a machine with nothing on it.
   */
  private snapshotIn(output: string): FactSnapshot {
    let parsed: unknown;

    try {
      parsed = JSON.parse(output);
    } catch {
      throw new RemoteOpenStrapError(`its answer was not JSON: ${output.slice(0, 200)}`);
    }

    try {
      return Facts.snapshotFrom(parsed);
    } catch (error) {
      throw new RemoteOpenStrapError(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * The order as one argument openstrap can be started with.
 *
 * Base64 rather than the JSON itself: it travels through whatever shell the transport uses to start a
 * process, and an encoding with no quotes, spaces or newlines in it cannot be reinterpreted on the way.
 */
export function encodeOrder(order: FactOrder): string {
  return Buffer.from(JSON.stringify(order), "utf8").toString("base64");
}
