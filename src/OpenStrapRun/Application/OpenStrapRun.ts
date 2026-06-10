import type { Blueprint } from "../../Blueprint/index.js";
import { Facts } from "../../Facts/Facts.js";
import type { FactsBackend } from "../../Plugin/index.js";
import {
  RequirementEvaluator,
  type RequirementRun,
} from "../../Requirements/index.js";
import { RequirementFactCollectionRequestBuilder } from "./RequirementFactCollectionRequestBuilder.js";

export type OpenStrapRunRequest = {
  blueprint: Blueprint;
  workspaceRoot: string;
  now?: Date;
};

export type OpenStrapRunResult = {
  blueprint: Blueprint;
  facts: Facts;
  requirementRun: RequirementRun;
};

export class OpenStrapRun {
  constructor(
    private readonly factsBackend: FactsBackend,
    private readonly factRequestBuilder = new RequirementFactCollectionRequestBuilder(),
    private readonly requirementEvaluator = new RequirementEvaluator(),
  ) {}

  async execute(request: OpenStrapRunRequest): Promise<OpenStrapRunResult> {
    const blueprint = request.blueprint;
    const facts = await this.collectFactsForBlueprint(blueprint, request);
    const requirementRun = this.evaluateBlueprintRequirements(blueprint, facts, request);

    return {
      blueprint,
      facts,
      requirementRun,
    };
  }

  private collectFactsForBlueprint(
    blueprint: Blueprint,
    request: OpenStrapRunRequest,
  ): Promise<Facts> {
    const factRequest = this.factRequestBuilder.build({
      target: blueprint.target,
      requirements: blueprint.target.requirements,
      workspaceRoot: request.workspaceRoot,
      now: request.now,
    });

    return Promise.resolve(this.factsBackend.collect(factRequest)).then((items) => new Facts(items));
  }

  private evaluateBlueprintRequirements(
    blueprint: Blueprint,
    facts: Facts,
    request: OpenStrapRunRequest,
  ): RequirementRun {
    return this.requirementEvaluator.evaluate({
      target: blueprint.target,
      requirements: blueprint.target.requirements,
      factCollection: facts,
      now: request.now,
      trigger: "manual",
      profile: "local-run",
      purpose: "preflight",
    });
  }
}
