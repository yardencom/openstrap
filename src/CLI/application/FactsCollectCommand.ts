import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Connect } from "#features/Connect/Connect.js";
import { Facts, everySection, type FactSnapshot } from "../../Modules/Facts/Facts.js";
import { RemoteOpenStrap } from "../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { Requirements } from "../../Modules/Requirements/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import { UnknownMachinePlatformError } from "../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import type { BlueprintTarget } from "#types/Blueprint.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { FactsCollectArgs } from "../arguments/types.js";

/**
 * What the command answers with: the snapshot, and nothing wrapped around it.
 *
 * Not `{ snapshot }`. A wrapper of one field is a wrapper a reader has to know about, and one reader
 * is openstrap itself — asked for facts on a machine it delivered itself to, it wants the snapshot,
 * not an envelope.
 */
export type FactsCollectResult = FactSnapshot;

/**
 * `openstrap facts collect` — read a machine and say what is on it.
 *
 * What gets read is decided by where the command was run. A blueprint in that directory naming this
 * machine says which facts matter — its requirements name them — and reading anything beyond them is
 * work nobody asked for. No blueprint, or one that says nothing about this machine, and the answer is
 * the machine entire. `--full` says "entire" out loud, for the times a blueprint is present and the
 * question is about the machine rather than about the blueprint.
 *
 * One rule, and it holds on the other side of a channel too: reading a machine openstrap is not on
 * means delivering openstrap there and starting it in a directory that has a blueprint in it. The
 * same sentence describes both cases, which is why there is no second mechanism — an encoded order on
 * the command line was one, and it was known only to the class that sent it.
 *
 * The sections that hold named things come back empty when nothing named them: no machine can list
 * every service or every program on it, and openstrap does not invent names to fill them with.
 *
 * Nothing is measured against anything — `openstrap run` is the command that compares — and nothing
 * is written anywhere: the answer is the answer.
 */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  constructor(
    private readonly stateHome = new StateHome(),
    private readonly blueprints = new Blueprints(),
  ) {}

  async execute(args: FactsCollectArgs, context: CommandContext): Promise<CommandOutcome<FactsCollectResult>> {
    const declared = args.full ? undefined : this.declaredFor(args.target, context);
    const snapshot = args.target === "host"
      ? await this.here(declared, context)
      : await this.there(args.target, declared, context);

    return {
      result: snapshot,
      // A machine that could not be read at all throws; a reading that came back with a failed
      // section is still a result, and the caller has to be able to notice.
      exitCode: snapshot.reading.status === "error" ? 1 : 0,
    };
  }

  /** This machine, read in process. */
  private here(declared: BlueprintTarget | undefined, context: CommandContext): Promise<FactSnapshot> {
    return Facts.collect({
      target: { name: "host", scope: "host", type: "host", displayName: "Local host" },
      declare: declared
        ? new Requirements(declared.requirements).order(context.workspaceRoot)
        : everySection,
      now: context.now,
    });
  }

  /**
   * A machine openstrap created, read by openstrap on it.
   *
   * Everything here is about getting there and back: finding the machine, opening the channel,
   * closing it, and putting away the store it was found in. What is collected once openstrap is there
   * is decided the same way as here — the requirements travel, and the openstrap on that machine
   * turns them into a reading exactly as this one would.
   *
   * The channel goes in as the connection reports it — which transport it was, and what it
   * authenticated with. A machine cannot say how anyone reached it, so the only thing that knows is
   * whatever opened the channel, and it is asked rather than guessed at from the blueprint.
   */
  private async there(
    target: string,
    declared: BlueprintTarget | undefined,
    context: CommandContext,
  ): Promise<FactSnapshot> {
    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const recorded = store.readTarget(target);
      const machine = store.readMachineImage(target);

      if (machine === null) {
        throw new UnknownMachinePlatformError(target);
      }

      const connection = await new Connect().execute({ target, runtime, store });

      try {
        return await new RemoteOpenStrap(connection.transport, machine).collect({
          target: { name: target, scope: recorded?.scope ?? "guest", type: recorded?.type ?? "vm" },
          requirements: declared?.requirements,
          channel: { type: connection.access.transport, authMethods: connection.transport.authMethods },
          now: context.now,
        });
      } finally {
        await connection.close();
      }
    } finally {
      store.close();
    }
  }

  /**
   * What the blueprint under this directory says about this machine, if it says anything.
   *
   * Optional on purpose: this command reads machines no blueprint mentions, and a directory with no
   * blueprint in it is the ordinary case rather than a mistake.
   */
  private declaredFor(target: string, context: CommandContext): BlueprintTarget | undefined {
    try {
      return this.blueprints.load({ workspaceRoot: context.workspaceRoot }).targets[target];
    } catch {
      return undefined;
    }
  }
}
