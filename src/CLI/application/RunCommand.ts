
import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Checks } from "../../Modules/Requirements/index.js";
import { Run, type RunResult as RunOutcome } from "#features/Run/Run.js";
import { WhereMachinesAreRecorded } from "./WhereMachinesAreRecorded.js";
import type { RunArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * What a run found. Targets as the blueprint declared them; what each machine turned out to be is on its
 * snapshot, which is the only place it is known — the provider says what it makes, not the file.
 */
export type RunResult = RunOutcome & {
  targets: Array<{
    name: string;
    provider?: string;
    transport?: string;
  }>;
};

/** `openstrap run` — take a blueprint from what it declares to what is true. */
export class RunCommand implements CliCommand<RunArgs, RunResult> {
  constructor(private readonly blueprints = new Blueprints()) {}

  async execute(args: RunArgs, context: CommandContext): Promise<CommandOutcome<RunResult>> {
    const blueprint = this.blueprints.load({
      explicitPath: args.configPath,
      workspaceRoot: context.workspaceRoot,
    });
    const runtime = await context.runtime();
    const recorded = await WhereMachinesAreRecorded.of(runtime, args.local);

    // Anything this machine did while no server was listening goes first: a run that never
    // left is a machine the team cannot see, and a server is now there to be told.
    await recorded.carry(await context.runtime(), context.now);

    try {
      const run = await new Run().execute({
        blueprint,
      // Where the file is, not where somebody ran from: its paths are about the repository it sits in.
        runtime,
        store: recorded.store,
        server: recorded.server,
        workspaceRoot: context.workspaceRoot,
        hostPort: args.hostPort ?? 2222,
        now: context.now,
      });

      return {
        result: {
          ...run,
          targets: Object.values(blueprint.targets).map((target) => ({
            name: target.name,
            provider: target.provider,
            transport: target.transport,
          })),
        },
        exitCode: Checks.succeeded(run.requirementRun.status) ? 0 : 1,
      };
    } finally {
      recorded.close();
    }
  }
}
