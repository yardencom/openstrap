import { Blueprints, type OpenStrapBlueprint } from "../../Blueprint/index.js";
import {
  LocalProcessFactCollector,
  type FactCollection,
} from "../../FactsRuntime/index.js";
import {
  RequirementEvaluator,
  type RequirementRun,
} from "../../Requirements/index.js";

export type OpenStrapRunRequest = {
  configPath?: string;
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapRunResult = {
  blueprint: OpenStrapBlueprint;
  facts: FactCollection;
  requirementRun: RequirementRun;
};

export class OpenStrapRun {
  constructor(
    private readonly blueprints = new Blueprints(),
    private readonly factCollector = new LocalProcessFactCollector(),
    private readonly requirementEvaluator = new RequirementEvaluator(),
  ) {}

  execute(request: OpenStrapRunRequest): OpenStrapRunResult {
    const blueprint = this.readBlueprint(request);
    const facts = this.collectFactsForBlueprint(blueprint, request);
    const requirementRun = this.evaluateBlueprintRequirements(blueprint, facts, request);

    return {
      blueprint,
      facts,
      requirementRun,
    };
  }

  private readBlueprint(request: OpenStrapRunRequest): OpenStrapBlueprint {
    if (request.configPath) {
      return this.blueprints.load({
        mode: "explicit",
        path: request.configPath,
      });
    }

    return this.blueprints.load({
      mode: "default",
      workspaceRoot: request.workspaceRoot,
    });
  }

  private collectFactsForBlueprint(
    blueprint: OpenStrapBlueprint,
    request: OpenStrapRunRequest,
  ): FactCollection {
    return this.factCollector.collect({
      targets: blueprint.targets,
      workspaceRoot: request.workspaceRoot,
      now: request.now,
    });
  }

  private evaluateBlueprintRequirements(
    blueprint: OpenStrapBlueprint,
    facts: FactCollection,
    request: OpenStrapRunRequest,
  ): RequirementRun {
    return this.requirementEvaluator.evaluate({
      requirements: blueprint.requirements,
      targets: blueprint.targets,
      factCollection: facts,
      now: request.now,
      trigger: "manual",
      profile: "local-run",
      purpose: "preflight",
    });
  }
}
