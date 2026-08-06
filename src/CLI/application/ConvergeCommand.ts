import { Blueprints, WrittenSteps } from "../../Modules/Blueprint/index.js";
import { Connect, UnknownMachineError } from "#features/Connect/Connect.js";
import { Converge, type ConvergeResult } from "#features/Converge/Converge.js";
import { RemoteOpenStrap } from "../../Modules/RemoteOpenStrap/RemoteOpenStrap.js";
import { Requirements, runSucceeded } from "../../Modules/Requirements/index.js";
import { SqliteStateStore, StateHome } from "../../StateStore/index.js";
import { UnknownMachinePlatformError } from "../../Modules/RemoteOpenStrap/errors/UnknownMachinePlatformError.js";
import { UnknownTargetError } from "../errors/UnknownTargetError.js";
import type { BlueprintTarget } from "#types/Blueprint.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";
import type { ConvergeArgs } from "../arguments/types.js";
import type { Target } from "#types/Target.js";

export type { ConvergeResult };

/**
 * `openstrap converge` — make a machine what its blueprint says it is.
 *
 * The fourth stage from the command line. The first three are already commands: a blueprint
 * declares, `facts collect` reads, `run` compares. This is the one that acts, and it does all four —
 * it has to, because acting without reading again is not converging, it is running commands.
 *
 * Which machine decides where the loop runs, and it always runs where the machine is. `host` is this
 * machine and the loop is here. Anything else is a machine openstrap created: openstrap is delivered
 * there with the blueprint, and the loop runs over there, on the far side of one round trip instead
 * of one per step. What comes back is a reading, and the verdict on it is worked out here — by the
 * side that knows what the machine is called.
 *
 * `--check` prints the plan and touches nothing, which is the same code path with the acting left
 * out rather than a second implementation that might disagree with the first.
 */
export class ConvergeCommand implements CliCommand<ConvergeArgs, ConvergeResult> {
  constructor(
    private readonly stateHome = new StateHome(),
    private readonly blueprints = new Blueprints(),
    private readonly converging = new Converge(),
  ) {}

  async execute(args: ConvergeArgs, context: CommandContext): Promise<CommandOutcome<ConvergeResult>> {
    const declared = this.declaredFor(args.target, context);
    const result = args.target === "host"
      ? await this.here(declared, args, context)
      : await this.there(declared, args, context);

    return {
      result,
      // What the machine is now, not whether openstrap managed to run anything. A convergence that
      // did everything it knew and left the machine short is a failure, and a `--check` that found
      // work to do is one too: it reports a machine that is not what was declared.
      exitCode: runSucceeded(result.requirementRun.status) ? 0 : 1,
    };
  }

  /** This machine, converged in process. This is also what the delivered openstrap runs. */
  private here(
    declared: BlueprintTarget,
    args: ConvergeArgs,
    context: CommandContext,
  ): Promise<ConvergeResult> {
    return this.converging.execute({
      target: { name: "host", scope: "host", type: "host", displayName: declared.displayName },
      requirements: declared.requirements,
      steps: declared.steps,
      check: args.check,
      maxPasses: args.maxPasses,
      now: context.now,
    });
  }

  /**
   * A machine openstrap created, converged by openstrap on it.
   *
   * Everything here is getting there and back. The blueprint's requirements and steps travel, the
   * loop happens there, and the proof is worked out here from the reading that came back: the same
   * requirements, the same checker, and a target with the name this side calls it by.
   *
   * The steps go back into the words they were written in. What arrives over there is a blueprint,
   * read by the same loader against the same schema, so it has to be a document a person could have
   * written — a step in the shape a plan is made of is not one, and openstrap over there refuses it.
   */
  private async there(
    declared: BlueprintTarget,
    args: ConvergeArgs,
    context: CommandContext,
  ): Promise<ConvergeResult> {
    const runtime = await context.runtime();
    const store = new SqliteStateStore(this.stateHome.database());

    try {
      const recorded = store.readTarget(declared.name);
      const platform = store.readMachineImage(declared.name);

      if (recorded === null) {
        throw new UnknownMachineError(declared.name);
      }

      if (platform === null) {
        throw new UnknownMachinePlatformError(declared.name);
      }

      const machine: Target = {
        name: declared.name,
        scope: recorded.scope,
        type: recorded.type,
        displayName: declared.displayName,
      };
      const connection = await new Connect().execute({ target: declared.name, runtime, store });

      try {
        const converged = await new RemoteOpenStrap(connection.transport, platform).converge({
          target: machine,
          requirements: declared.requirements,
          steps: declared.steps && WrittenSteps.asWritten(declared.steps),
          check: args.check,
          maxPasses: args.maxPasses,
          channel: { type: connection.access.transport, authMethods: connection.transport.authMethods },
          now: context.now,
        });

        return {
          ...converged,
          requirementRun: new Requirements(declared.requirements).checkedAgainst({
            target: machine,
            snapshots: [converged.snapshot],
            attempt: converged.passes.length + 1,
            trigger: "converge",
            purpose: "converge",
            now: context.now,
          }),
        };
      } finally {
        await connection.close();
      }
    } finally {
      store.close();
    }
  }

  /**
   * What the blueprint under this directory says about this machine.
   *
   * Required, unlike reading facts. A machine can be read with nothing declared about it — "tell me
   * what is here" is a question. "Make it right" is not: without a blueprint there is no right.
   */
  private declaredFor(target: string, context: CommandContext): BlueprintTarget {
    const blueprint = this.blueprints.load({ workspaceRoot: context.workspaceRoot });
    const declared = blueprint.targets[target];

    if (declared === undefined) {
      throw new UnknownTargetError(target, Object.keys(blueprint.targets));
    }

    return declared;
  }
}
