import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Facts } from "../../Modules/Facts/Facts.js";
import { FactSnapshot, Moment } from "../../Modules/Facts/FactSnapshot.js";
import {
  mergeRequirementRuns,
  RequiredFacts,
  RequirementEvaluator,
  runSucceeded,
  type RequirementRun,
} from "../../Modules/Requirements/index.js";
import type { RunArgs } from "../arguments/types.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";


export type RunResult = {
  targets: Array<{
    name: string;
    scope: string;
    type: string;
    transport: string;
  }>;
  snapshots: readonly FactSnapshot[];
  requirementRun: RequirementRun;
};

/**
 * `openstrap run` — read every target a blueprint declares and check what it requires.
 *
 * Reading and judging happen per target and in that order, so a requirement about one
 * machine is never answered by another machine's snapshot: the evaluator is handed only
 * the facts of the target it is judging.
 */
export class RunCommand implements CliCommand<RunArgs, RunResult> {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly evaluator = new RequirementEvaluator(),
  ) {}

  async execute(args: RunArgs, context: CommandContext): Promise<CommandOutcome<RunResult>> {
    const run = await this.run(args, context);

    return {
      result: run,
      exitCode: runSucceeded(run.requirementRun.status) ? 0 : 1,
    };
  }

  private async run(args: RunArgs, context: CommandContext): Promise<RunResult> {
    const blueprint = this.blueprints.load({
      explicitPath: args.configPath,
      workspaceRoot: context.workspaceRoot,
    });
    const collected: FactSnapshot[] = [];
    const runs: RequirementRun[] = [];

    for (const target of Object.values(blueprint.targets)) {
      // Every target of a plain run is the machine openstrap is on, so every one of them is read
      // here, and each reading is named after the target it was asked about.
      const facts = await Facts.collect({
        declare: new RequiredFacts({
          requirements: target.requirements,
          workspaceRoot: context.workspaceRoot,
        }).declaration,
      });
      const snapshot = new FactSnapshot(
        { name: target.name, scope: target.scope, type: target.type, displayName: target.displayName },
        facts,
        context.now === undefined ? Moment.now() : new Moment(context.now),
      );

      collected.push(snapshot);
      runs.push(this.evaluator.evaluate({
        target,
        requirements: target.requirements,
        snapshots: [snapshot],
        now: context.now,
        trigger: "manual",
        profile: "local-run",
        purpose: "preflight",
      }));
    }

    return {
      targets: Object.values(blueprint.targets).map((target) => ({
        name: target.name,
        scope: target.scope,
        type: target.type,
        transport: target.transport,
      })),
      snapshots: collected,
      requirementRun: mergeRequirementRuns(runs),
    };
  }
}
