import { RunningMachineError } from "../errors/RunningMachineError.js";
import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { RemoveArgs } from "../arguments/types.js";
import type { OpenStrapRuntime, Provider } from "../../Plugin/index.js";
import type { TargetRecord } from "../../Store/index.js";

export { RunningMachineError } from "../errors/RunningMachineError.js";

export type RemoveResult = {
  target: string;
  provider?: string;
  /** What became of the machine itself: deleted where the provider held one, none where it held none. */
  machine: "deleted" | "none";
  detail?: string;
};

/** `remove` — the machine gone from its provider and its record gone from here, so `list` stops naming it. */
export class RemoveCommand implements CliCommand<RemoveArgs, RemoveResult> {
  constructor(
    private readonly open = (runtime: OpenStrapRuntime, local: boolean) =>
      WhereMachinesAreRecorded.of(runtime, local),
  ) {}

  async execute(args: RemoveArgs, context: CommandContext): Promise<CommandOutcome<RemoveResult>> {
    const runtime = await context.runtime();
    const recorded = await this.open(runtime, args.local);

    try {
      if (recorded.server !== undefined) {
        throw new Error(
          `machines recorded on a server cannot be removed from here yet; pass --local to remove this computer's own record of "${args.target}"`,
        );
      }

      const record = recorded.local.machines.read(args.target);

      if (record === null) {
        throw new Error(`no machine called "${args.target}" is recorded on this computer`);
      }

      const gone = await this.machineGone(record, runtime, args.force);
      recorded.local.machines.remove(args.target);

      return { result: { target: args.target, provider: record.provider, ...gone }, exitCode: 0 };
    } finally {
      recorded.close();
    }
  }

  private async machineGone(
    record: TargetRecord,
    runtime: OpenStrapRuntime,
    force: boolean,
  ): Promise<Pick<RemoveResult, "machine" | "detail">> {
    if (record.provider === undefined) {
      return { machine: "none", detail: "nothing recorded which provider held it" };
    }

    const provider = runtime.providers.get(record.provider);

    if (provider === undefined) {
      if (!force) {
        throw new Error(
          `no ${record.provider} plugin on this computer, so the machine cannot be deleted; pass --force to drop the record and leave the machine where it is`,
        );
      }

      return { machine: "none", detail: `no ${record.provider} plugin on this computer; the machine, if there is one, was left where it is` };
    }

    try {
      return await RemoveCommand.deleted(record.name, provider, force);
    } catch (error) {
      if (!force || error instanceof RunningMachineError) {
        throw error;
      }

      return { machine: "none", detail: `${provider.id} did not delete it: ${error instanceof Error ? error.message : String(error)}; the machine, if there is one, was left where it is` };
    }
  }

  private static async deleted(name: string, provider: Provider, force: boolean): Promise<Pick<RemoveResult, "machine" | "detail">> {
    const handle = await provider.find(name);

    if (handle === null) {
      return { machine: "none", detail: `${provider.id} had no machine by that name` };
    }

    if ((await provider.inspect(handle)).status === "running" && !force) {
      throw new RunningMachineError(name);
    }

    await provider.delete(handle);

    return { machine: "deleted" };
  }
}
