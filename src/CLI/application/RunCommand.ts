import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Facts } from "../../Modules/Facts/Facts.js";
import {
  mergeRequirementRuns,
  RequiredFacts,
  RequirementEvaluator,
  runSucceeded,
  type RequirementRun,
} from "../../Modules/Requirements/index.js";
import type { RunArgs } from "../Arguments/types.js";
import { renderRunOutput } from "../Output/RunOutput.js";
import { asJson } from "../Output/JsonOutput.js";
import type { CliCommand, CommandContext, CommandOutcome } from "./CliCommand.js";

type FactCollection = Awaited<ReturnType<Facts["collect"]>>;

export type OpenStrapRunOutput = {
  targets: Array<{
    name: string;
    scope: string;
    type: string;
    transport: string;
  }>;
  facts: FactCollection;
  requirementRun: RequirementRun;
};

/**
 * `openstrap run` — read every target a blueprint declares and check what it requires.
 *
 * Reading and judging happen per target and in that order, so a requirement about one
 * machine is never answered by another machine's snapshot: the evaluator is handed only
 * the facts of the target it is judging.
 */
export class RunCommand implements CliCommand<RunArgs> {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly evaluator = new RequirementEvaluator(),
  ) {}

  async execute(args: RunArgs, context: CommandContext): Promise<CommandOutcome> {
    const run = await this.run(args, context);

    return {
      output: args.json ? asJson(run) : renderRunOutput(run),
      exitCode: runSucceeded(run.requirementRun.status) ? 0 : 1,
    };
  }

  private async run(args: RunArgs, context: CommandContext): Promise<OpenStrapRunOutput> {
    const blueprint = this.blueprints.load({
      explicitPath: args.configPath,
      workspaceRoot: context.workspaceRoot,
    });
    // One instance per machine, because an instance is a way of reaching one. Every
    // target of a plain run is the machine openstrap is on, so every one of them is
    // read in process.
    const host = new Facts();
    const collected: FactCollection[number][] = [];
    const runs: RequirementRun[] = [];

    for (const target of Object.values(blueprint.targets)) {
      const facts = await host.collect({
        target: {
          name: target.name,
          scope: target.scope,
          type: target.type,
          displayName: target.displayName,
          transport: target.transport,
        },
        declare: new RequiredFacts({
          requirements: target.requirements,
          workspaceRoot: context.workspaceRoot,
        }).declaration,
        now: context.now,
      });

      collected.push(...facts);
      runs.push(this.evaluator.evaluate({
        target,
        requirements: target.requirements,
        factCollection: facts,
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
      facts: collected,
      requirementRun: mergeRequirementRuns(runs),
    };
  }
}
