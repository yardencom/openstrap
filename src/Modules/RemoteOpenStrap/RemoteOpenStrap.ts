import { RemoteOpenStrapError } from "./errors/RemoteOpenStrapError.js";
import type { Transport } from "@openstrap/plugin-contract";
import { Facts, type FactSnapshot } from "../Facts/Facts.js";
import type { Convergence } from "#types/Convergence.js";
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

/** The same machine, and what it should be brought to rather than only read. */
export type RemoteConvergeRequest = RemoteCollectRequest & {
  /** How this machine is made right, as its blueprint says. Travels with the blueprint. */
  steps?: readonly unknown[];
  /** Work out the plan over there and change nothing. */
  check?: boolean;
  maxPasses?: number;
};

/**
 * What openstrap over there did, and the machine as it left it.
 *
 * No requirement run. openstrap over there produced one, and it is about a machine it calls `host`,
 * because that is what the machine is from where it stands. The proof belongs to the side that knows
 * the machine's name, and that side has the reading — so it judges it itself, with the same code.
 */
export type RemoteConvergence = Omit<Convergence, "requirementRun"> & { snapshot: FactSnapshot };

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
   * Puts openstrap on the target and has it bring the machine to what the blueprint declares.
   *
   * The same road as reading, and deliberately the same: openstrap is delivered, a blueprint is left
   * under its feet, and openstrap over there is run in that directory. The difference is one word of
   * the command line and the steps in the blueprint.
   *
   * Acting happens on the machine and not from here, for the reason reading does: a machine acted on
   * over a channel and a machine acted on from inside would be two implementations, and the loop —
   * act, read again, act again — would pay a round trip for every step of it. What crosses the
   * channel is a document going out and a document coming back.
   */
  async converge(request: RemoteConvergeRequest): Promise<RemoteConvergence> {
    const openstrap = await new OpenStrapBinary(this.machine).deliverTo(this.transport.fileSystem);

    await this.declare(request);

    const result = await this.transport.processes.capture({
      command: openstrap,
      args: [
        "converge", "host", "--json",
        ...(request.check ? ["--check"] : []),
        ...(request.maxPasses === undefined ? [] : ["--max-passes", String(request.maxPasses)]),
      ],
      cwd: OpenStrapBinary.directory,
    });

    // Unlike a reading, a non-zero exit is an ordinary answer here: a machine that could not be
    // brought all the way is still a machine openstrap has something to say about, and the plan and
    // the passes are that something. Only silence is a failure.
    return this.convergenceIn(result.stdout, result.stderr, request);
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
  private async declare(request: RemoteConvergeRequest): Promise<void> {
    const blueprint = this.transport.fileSystem.joinPath(OpenStrapBinary.directory, "openstrap.yaml");
    const requirements = request.requirements ?? [];
    const steps = request.steps ?? [];

    if (requirements.length === 0 && steps.length === 0) {
      await this.transport.fileSystem.removePath(blueprint, { force: true });

      return;
    }

    // No provider and no transport: openstrap over there is on the machine it is about, and nothing
    // reached it to get there. Steps travel in the blueprint because that is where a person wrote
    // them, and because a plugin that knows how to make something true is installed here rather than
    // there — the blueprint is the one thing that reaches the machine.
    await this.transport.fileSystem.writeTextFile(blueprint, JSON.stringify({
      targets: {
        host: {
          requirements,
          ...(steps.length === 0 ? {} : { steps }),
        },
      },
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
   * What openstrap printed over there, which is one convergence.
   *
   * The snapshot inside it is put back together the same way a reading is, and named the same way:
   * it is the same document, printed by the same code, and it arrived by the same road.
   */
  private convergenceIn(output: string, said: string, request: RemoteConvergeRequest): RemoteConvergence {
    let parsed: unknown;

    try {
      parsed = JSON.parse(output);
    } catch {
      throw new RemoteOpenStrapError(`its answer was not JSON: ${(output || said).slice(0, 200)}`);
    }

    if (!parsed || typeof parsed !== "object" || !("snapshot" in parsed)) {
      throw new RemoteOpenStrapError(`its answer was not a convergence: ${output.slice(0, 200)}`);
    }

    // Taken off rather than left to the type to hide: openstrap over there judged a machine it calls
    // `host`, and a caller reaching for that verdict would get one about a name nobody here uses.
    // The reading is what travels; the judging happens where the machine has its name.
    const { requirementRun, ...printed } = parsed as RemoteConvergence & {
      snapshot: unknown;
      requirementRun?: unknown;
    };

    void requirementRun;

    try {
      return { ...printed, snapshot: Facts.snapshotFrom(this.named(printed.snapshot, request)) };
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
