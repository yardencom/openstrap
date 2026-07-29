import { ConnectToTarget } from "../../Connect/index.js";
import { Facts, everySection, type FactSnapshot } from "../../Modules/Facts/Facts.js";
import { RemoteOpenStrap } from "../../RemoteOpenStrap/RemoteOpenStrap.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import type { FactsCollectArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * What the command answers with: the snapshot, and nothing wrapped around it.
 *
 * Not `{ snapshot }`. A wrapper of one field is a wrapper a reader has to know about, and one reader
 * is openstrap itself — asked for facts on a machine it delivered itself to, it wants the snapshot,
 * not an envelope.
 */
export type FactsCollectResult = FactSnapshot;

/**
 * `openstrap facts collect` — read this machine and say what is on it.
 *
 * Asking openstrap for the facts is asking for the facts, so the order names every section there is.
 * Nothing is measured against anything: requirements and everything else a blueprint intends are
 * deliberately absent — `openstrap run` is the command that compares, and this one only looks. The
 * sections that hold named things come back empty, because nothing on a machine can list every
 * service or every program on it and openstrap does not invent names to fill them with.
 *
 * Which machine is the argument: `host` is the one openstrap is running on, and any other name is a
 * target it created, which it reads by delivering itself there and asking. Both answer with the same
 * snapshot of the same shape, because both were collected by the same code — that is the whole point
 * of openstrap going to a machine rather than asking about it from outside.
 *
 * Nothing is written anywhere: the answer is the answer. Keeping snapshots is what a run does, and
 * this is the command openstrap runs on a machine it was asked only to read.
 */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  constructor(private readonly stateHome = new StateHome()) {}

  async execute(args: FactsCollectArgs, context: CommandContext): Promise<CommandOutcome<FactsCollectResult>> {
    const snapshot = args.target === "host"
      ? await Facts.collect(args.order ?? {
        target: { name: "host", scope: "host", type: "host", displayName: "Local host" },
        declare: everySection,
        now: context.now,
      })
      : await this.read(args.target, context);

    return {
      result: snapshot,
      // A machine that could not be read at all throws; a reading that came back with a failed
      // section is still a result, and the caller has to be able to notice.
      exitCode: snapshot.reading.status === "error" ? 1 : 0,
    };
  }

  /**
   * A machine openstrap created, read by openstrap on it.
   *
   * Everything here is about getting there and back: finding the machine, opening the channel,
   * closing it, and putting away the store it was found in. What is collected once openstrap is
   * there is the same as anywhere else.
   *
   * The channel goes in as the connection reports it — which transport it was, and what it
   * authenticated with. A machine cannot say how anyone reached it, so the only thing that knows is
   * whatever opened the channel, and it is asked rather than guessed at from the blueprint.
   */
  private async read(target: string, context: CommandContext): Promise<FactSnapshot> {
    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const recorded = store.readTarget(target);
      const connection = await new ConnectToTarget().execute({ target, runtime, store });

      try {
        return await new RemoteOpenStrap(connection.transport).collect({
          target: { name: target, scope: recorded?.scope ?? "machine", type: recorded?.type ?? "vm" },
          declare: everySection,
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
}
