import { Blueprints } from "../../Modules/Blueprint/index.js";
import { runSucceeded } from "../../Modules/Requirements/index.js";
import { Run, type RunResult as RunOutcome } from "#features/Run/Run.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import type { RunArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

/**
 * What a run found: which machines it was about, and how they measured up.
 *
 * The targets are reported as the blueprint declared them. What each machine turned out to be is on
 * the snapshot it produced, which is the only place it is known: a blueprint names a provider, and
 * the provider is what says whether that makes a vm or a container.
 */
export type RunResult = RunOutcome & {
  targets: Array<{
    name: string;
    provider?: string;
    transport?: string;
  }>;
};

/**
 * `openstrap run` — take a blueprint from what it declares to what is true.
 *
 * Every target: a machine with a provider is made, started and read where it is; the machine
 * openstrap is on is read here. What that means step by step belongs to the feature, and this
 * command does a command's work — find the blueprint, hand over the store and the runtime, turn
 * the answer into an exit code.
 */
export class RunCommand implements CliCommand<RunArgs, RunResult> {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly stateHome = new StateHome(),
  ) {}

  async execute(args: RunArgs, context: CommandContext): Promise<CommandOutcome<RunResult>> {
    const blueprint = this.blueprints.load({
      explicitPath: args.configPath,
      workspaceRoot: context.workspaceRoot,
    });
    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const run = await new Run().execute({
        blueprint,
        runtime,
        store,
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
        exitCode: runSucceeded(run.requirementRun.status) ? 0 : 1,
      };
    } finally {
      store.close();
    }
  }
}
