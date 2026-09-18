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
  /** Secrets the steps named, already fetched, keyed by the variable they arrive in. */
  secrets?: Readonly<Record<string, string>>;
};

/** What openstrap over there did, and the machine as it left it. */
export type RemoteConvergence = Omit<Convergence, "requirementRun"> & { snapshot: FactSnapshot };

/** openstrap on a machine openstrap is not running on. */
export class RemoteOpenStrap {
  /** @param machine What kind of machine this is, as it was recorded when openstrap created it. */
  constructor(
    private readonly transport: Transport,
    private readonly machine: MachinePlatform,
  ) {}

  /** Puts openstrap on the target, has it read the machine, and returns the snapshot it took. */
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

  /** Puts openstrap on the target and has it bring the machine to what the blueprint declares. */
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
      // Not on the command line, where a process list would show them, and not in the blueprint,
      // where a disk would keep them.
      environment: request.secrets,
    });

    // Unlike a reading, a non-zero exit is an ordinary answer here: a machine that could not be
    // brought all the way is still a machine openstrap has something to say about, and the plan and
    // the passes are that something. Only silence is a failure.
    return this.convergenceIn(result.stdout, result.stderr, request);
  }

  /** The blueprint the delivered openstrap will find under its feet. */
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

  /** What openstrap printed over there, which is one snapshot. */
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

  /** What openstrap printed over there, which is one convergence. */
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

  /** The reading, named by whoever asked for it and stamped with the channel they opened. */
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
