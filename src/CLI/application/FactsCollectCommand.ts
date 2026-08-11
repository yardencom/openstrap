import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Connect, UnknownMachineError } from "#features/Connect/Connect.js";
import { Facts, everySection, type FactSnapshot } from "../../Modules/Facts/Facts.js";
import { RemoteOpenStrap } from "../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { Requirements } from "../../Modules/Requirements/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
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
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const recorded = store.readTarget(target);
      const machine = store.readMachineImage(target);

      if (machine === null) {
        throw new UnknownMachinePlatformError(target);
      }

      // What kind of machine this is was written down when it was made, by the provider that makes
      // it. A machine openstrap has no row for is one it never made — `connect` says so, and this
      // used to call it a guest vm and read it anyway.
      if (recorded === null) {
        throw new UnknownMachineError(target);
      }

      const connection = await new Connect().execute({ target, runtime, store });

      try {
        return await new RemoteOpenStrap(connection.transport, machine).collect({
          target: { name: target, scope: recorded.scope, type: recorded.type },
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

  /** Optional: this command reads machines no blueprint mentions, and that is the ordinary case. */
  private declaredFor(target: string, context: CommandContext): BlueprintTarget | undefined {
    try {
      return this.blueprints.load({ workspaceRoot: context.workspaceRoot }).targets[target];
    } catch {
      return undefined;
    }
  }
}
