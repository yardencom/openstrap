import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Converge, type ConvergeResult } from "#features/Converge/Converge.js";
import { runSucceeded } from "../../Modules/Requirements/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import { UnknownTargetError } from "../errors/UnknownTargetError.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { ConvergeArgs } from "../arguments/types.js";

export type { ConvergeResult };

/**
 * `openstrap converge` — make a machine what its blueprint says it is.
 *
 * The fourth stage from the command line. What it does is find the target and hand it over: which
 * machine, where the loop turns, how the far side is reached and who judges the reading are the
 * feature's to decide, and `run` reaches the same feature for the same target. A copy of that
 * decision here would be the copy that drifts.
 *
 * A blueprint is required, unlike reading facts. A machine can be read with nothing declared about
 * it — "tell me what is here" is a question — and "make it right" without a blueprint is not.
 */
export class ConvergeCommand implements CliCommand<ConvergeArgs, ConvergeResult> {
  constructor(
    private readonly stateHome = new StateHome(),
    private readonly blueprints = new Blueprints(),
    private readonly converge = new Converge(),
  ) {}

  async execute(args: ConvergeArgs, context: CommandContext): Promise<CommandOutcome<ConvergeResult>> {
    const blueprint = this.blueprints.load({ workspaceRoot: context.workspaceRoot });
    const target = blueprint.targets[args.target];

    if (target === undefined) {
      throw new UnknownTargetError(args.target, Object.keys(blueprint.targets));
    }

    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const result = await this.converge.execute({
        target,
        runtime: await context.runtime(),
        store,
        check: args.check,
        maxPasses: args.maxPasses,
        now: context.now,
      });

      return {
        result,
        // What the machine is now, not whether openstrap managed to run anything. A convergence that
        // did everything it knew and left the machine short is a failure, and a `--check` that found
        // work to do is one too: it reports a machine that is not what was declared.
        exitCode: runSucceeded(result.requirementRun.status) ? 0 : 1,
      };
    } finally {
      store.close();
    }
  }
}
