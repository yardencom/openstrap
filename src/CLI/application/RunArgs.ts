import { Blueprints } from "../../Modules/Blueprint/index.js";
import { Facts } from "../../Modules/Facts/Facts.js";
import {
  mergeRequirementRuns,
  RequiredFacts,
  RequirementEvaluator,
  type RequirementRun,
} from "../../Modules/Requirements/index.js";

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

export type OpenStrapRunRequest = {
  configPath?: string;
  workspaceRoot: string;
  now?: Date;
};

/**
 * `openstrap run` — read every target a blueprint declares and check what it requires.
 *
 * Reading and judging happen per target and in that order, so a requirement about one
 * machine is never answered by another machine's snapshot: the evaluator is handed
 * only the facts of the target it is judging.
 */
export async function runOpenStrapFlow(request: OpenStrapRunRequest): Promise<OpenStrapRunOutput> {
  const blueprint = new Blueprints().load({
    explicitPath: request.configPath,
    workspaceRoot: request.workspaceRoot,
  });
  // One instance per machine, because an instance is a way of reaching one. Every
  // target of a plain run is the machine openstrap is on, so every one of them is
  // read in process.
  const host = new Facts();
  const evaluator = new RequirementEvaluator();
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
        workspaceRoot: request.workspaceRoot,
      }).declaration,
      now: request.now,
    });

    collected.push(...facts);
    runs.push(evaluator.evaluate({
      target,
      requirements: target.requirements,
      factCollection: facts,
      now: request.now,
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
