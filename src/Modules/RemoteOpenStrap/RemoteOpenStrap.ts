import { RemoteOpenStrapError } from "./errors/RemoteOpenStrapError.js";
import type { Transport } from "@openstrap/plugin-contract";
import { Facts, type FactSnapshot } from "../Facts/Facts.js";
import type { Target } from "#types/Target.js";
import { OpenStrapBinary } from "./deliver/OpenStrapBinary.js";
import type { MachinePlatform } from "#types/Machine.js";


/** Which machine is being read, and what the reading is about. */
export type RemoteCollectRequest = {
  target: Target;
  /** What has to be true of this machine. Nothing means: read all of it. */
  requirements?: readonly unknown[];
  channel?: { type: string; authMethods?: readonly string[] };
  now?: Date;
};

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

  /**
   * Puts openstrap on the target, has it read the machine, and returns the snapshot it took.
   *
   * What to read is said the way it is said everywhere else: a blueprint in the directory openstrap
   * is started in. It is written there for the purpose, next to the delivered binary, and openstrap
   * over there does what openstrap here does with a blueprint under its feet — reads exactly what the
   * requirements are about. Given none, it reads the machine entire.
   *
   * This used to travel as a base64 argument, which meant two ways of saying the same thing and one
   * of them known only to this class. There is one way now, and the openstrap on the other side is
   * not a special build being driven by a private flag: it is openstrap, run in a directory.
   */
  async collect(request: RemoteCollectRequest): Promise<FactSnapshot> {
    const openstrap = await new OpenStrapBinary(this.machine).deliverTo(this.transport.fileSystem);

    await this.declare(request);

    const result = await this.transport.processes.capture({
      command: openstrap,
      args: ["facts", "collect", "host", "--json"],
      // Where the blueprint was left. openstrap finds what to read the same way a person would.
      cwd: OpenStrapBinary.directory,
    });

    if (result.exitCode !== 0) {
      throw new RemoteOpenStrapError(result.stderr.trim() || `exit ${result.exitCode}`);
    }

    return this.snapshotIn(result.stdout, request);
  }

  /**
   * The blueprint the delivered openstrap will find under its feet.
   *
   * One target, named `host`, carrying the requirements this reading is about — the same words a
   * person writes in their own blueprint, so the machine is read by the same rule wherever the
   * reading was asked for.
   *
   * Written as JSON into a `.yaml` file, which is not a trick: YAML is a superset of JSON, and this
   * file is generated rather than read by anyone, so the honest thing is the serialiser that cannot
   * get quoting wrong.
   *
   * Nothing is written when there are no requirements. Then there is no blueprint on the other side,
   * and openstrap there does what it does without one: reads the machine entire.
   */
  private async declare(request: RemoteCollectRequest): Promise<void> {
    const blueprint = this.transport.fileSystem.joinPath(OpenStrapBinary.directory, "openstrap.yaml");

    if (!request.requirements || request.requirements.length === 0) {
      await this.transport.fileSystem.removePath(blueprint, { force: true });

      return;
    }

    // No provider and no transport: openstrap over there is on the machine it is about, and nothing
    // reached it to get there.
    await this.transport.fileSystem.writeTextFile(blueprint, JSON.stringify({
      targets: { host: { requirements: request.requirements } },
    }, null, 2));
  }

  /**
   * What openstrap printed over there, which is one snapshot.
   *
   * Read back into the types a snapshot is made of rather than cast into a lookalike of one: what
   * came over the channel is text, and the snapshot knows how to be itself again. Anything
   * unparseable is a failure rather than an empty reading — a machine that answered with noise has
   * not been read, and reporting no facts would make that look like a machine with nothing on it.
   */
  private snapshotIn(output: string, request: RemoteCollectRequest): FactSnapshot {
    let parsed: unknown;

    try {
      parsed = JSON.parse(output);
    } catch {
      throw new RemoteOpenStrapError(`its answer was not JSON: ${output.slice(0, 200)}`);
    }

    try {
      return Facts.snapshotFrom(this.named(parsed, request));
    } catch (error) {
      throw new RemoteOpenStrapError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * The reading, named by whoever asked for it and stamped with the channel they opened.
   *
   * openstrap over there read `host`, because from where it stood that is what the machine is. It
   * cannot know that anyone calls it `ubuntu-vm`, and it cannot know it was reached over ssh with a
   * key — the machine has no view of the connection into it. Both of those are known here, by the
   * side that did the calling, so both are written here.
   *
   * They used to travel the other way, in the order: openstrap told openstrap what to call the
   * machine and which channel to record. That made the far side responsible for repeating something
   * it had been handed, which is a fact about nothing.
   */
  private named(printed: unknown, request: RemoteCollectRequest): unknown {
    // Anything that is not an object is not a reading, and dressing it in a name would turn a
    // machine that answered with noise into a snapshot with nothing in it. Handed on untouched, it
    // is refused by the one place that refuses such things.
    if (!printed || typeof printed !== "object" || Array.isArray(printed)) {
      return printed;
    }

    const snapshot = printed as { scope?: unknown; target?: unknown; facts?: Record<string, unknown> };

    return {
      ...snapshot,
      scope: request.target.scope,
      target: { type: request.target.type, id: request.target.name, displayName: request.target.displayName },
      facts: {
        ...snapshot.facts,
        transports: request.channel
          ? { [request.channel.type]: {
            status: "present",
            type: request.channel.type,
            ready: true,
            ...(request.channel.authMethods ? { authMethods: request.channel.authMethods } : {}),
          } }
          : snapshot.facts?.transports ?? {},
      },
    };
  }
}
