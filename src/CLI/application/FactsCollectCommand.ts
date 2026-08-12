import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Connect } from "#features/Connect/Connect.js";
import { Facts, everySection, type FactSnapshot } from "../../Modules/Facts/Facts.js";
import { RemoteOpenStrap } from "../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { Requirements } from "../../Modules/Requirements/index.js";
import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";
import { UnknownMachinePlatformError } from "../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import type { BlueprintTarget } from "#types/Blueprint.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { FactsCollectArgs } from "../arguments/types.js";

/**
 * The snapshot, and nothing wrapped around it: one reader is openstrap itself, reading what it printed on a
 * machine it delivered itself to, and an envelope is a thing it would have to know about.
 */
export type FactsCollectResult = FactSnapshot;

/** `openstrap facts collect` — read a machine and say what is on it. */
export class FactsCollectCommand implements CliCommand<FactsCollectArgs, FactsCollectResult> {
  constructor(private readonly blueprints = new Blueprints()) {}

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
        ? new Requirements(declared.requirements).order()
        : everySection,
      now: context.now,
    });
  }

  /** A machine openstrap created, read by openstrap on it. */
  private async there(
    target: string,
    declared: BlueprintTarget | undefined,
    context: CommandContext,
  ): Promise<FactSnapshot> {
    const runtime = await context.runtime();
    const recorded = new WhereMachinesAreRecorded();

    // Anything this machine did while no server was listening goes first: a run that never
    // left is a machine the team cannot see, and a server is now there to be told.
    await recorded.carry(context.now);

    try {
      const connection = await new Connect().execute({
        target,
        runtime,
        store: recorded.store,
        server: recorded.server,
      });

      try {
        // What kind of machine this is was written down when it was made, by the provider that makes
        // it. Without it there is no telling which build of openstrap to deliver, and this used to
        // call the machine a guest vm and read it anyway.
        if (connection.machine === undefined) {
          throw new UnknownMachinePlatformError(target);
        }

        return await new RemoteOpenStrap(connection.transport, connection.machine).collect({
          target: { name: target, ...connection.kind },
          requirements: declared?.requirements,
          channel: { type: connection.access.transport, authMethods: connection.transport.authMethods },
          now: context.now,
        });
      } finally {
        await connection.close();
      }
    } finally {
      recorded.close();
    }
  }

  /** Optional: this command reads machines no blueprint mentions, and that is the ordinary case. */
  private declaredFor(target: string, context: CommandContext): BlueprintTarget | undefined {
    try {
      return this.blueprints.load({ workspaceRoot: context.workspaceRoot }).targets[target];
    } catch {
      return undefined;
    }
  }
}
