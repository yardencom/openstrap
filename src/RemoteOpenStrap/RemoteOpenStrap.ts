import type { Transport } from "../Transport/index.js";
import type { FactOrder, FactSnapshot } from "../Modules/Facts/Facts.js";
import { OpenStrapBinary } from "./OpenStrapBinary.js";
import { TargetPlatform } from "./TargetPlatform.js";

export class RemoteOpenStrapError extends Error {
  constructor(detail: string) {
    super(`openstrap on the target did not answer: ${detail}`);
    this.name = "RemoteOpenStrapError";
  }
}

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
  constructor(private readonly transport: Transport) {}

  /** Puts openstrap on the target, has it read the machine, and returns the snapshot it took. */
  async collect(order: FactOrder): Promise<FactSnapshot> {
    const platform = await TargetPlatform.detect(this.transport.fileSystem);
    const openstrap = await new OpenStrapBinary(platform).deliverTo(this.transport.fileSystem);
    const result = await this.transport.processes.capture({
      command: openstrap,
      args: ["facts", "collect", "--json", "--order", encodeOrder(order)],
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
   * The schema it claims is checked and nothing else is: the snapshot was made by openstrap, and
   * re-deriving what openstrap already decided would be a second opinion about the same reading.
   * Anything unparseable is a failure rather than an empty reading — a machine that answered with
   * noise has not been read, and reporting no facts would make that look like a machine with nothing
   * on it.
   */
  private snapshotIn(output: string): FactSnapshot {
    let parsed: unknown;

    try {
      parsed = JSON.parse(output);
    } catch {
      throw new RemoteOpenStrapError(`its answer was not JSON: ${output.slice(0, 200)}`);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RemoteOpenStrapError("its answer was not a snapshot");
    }

    const snapshot = parsed as FactSnapshot;

    if (snapshot.schemaVersion !== "facts.v1") {
      throw new RemoteOpenStrapError(
        `it answered with ${JSON.stringify(snapshot.schemaVersion)}, which this openstrap does not read`,
      );
    }

    return snapshot;
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
